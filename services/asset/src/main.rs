use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Json, IntoResponse},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

struct AppState {
    sdf_engine_url: String,
    storage_path: String,
    start_time: std::time::Instant,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_secs: u64,
}

#[derive(Debug, Serialize)]
struct ExportResponse {
    export_id: String,
    format: String,
    status: String,
    download_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct FormatInfo {
    name: String,
    extension: String,
    category: String,
    description: String,
}

#[derive(Debug, Serialize)]
struct FormatsResponse {
    total: usize,
    formats: Vec<FormatInfo>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "asset_service=info".into()),
        )
        .init();

    let storage_path = std::env::var("ASSET_STORAGE_PATH")
        .unwrap_or_else(|_| "/tmp/ai-modeler-assets".to_string());
    tokio::fs::create_dir_all(&storage_path).await.ok();

    let state = Arc::new(AppState {
        sdf_engine_url: std::env::var("SDF_ENGINE_URL")
            .unwrap_or_else(|_| "http://sdf-engine:8081".to_string()),
        storage_path,
        start_time: std::time::Instant::now(),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/asset/export", post(export_asset))
        .route("/api/v1/asset/formats", get(list_formats))
        .route("/api/v1/asset/download/:export_id", get(download_asset))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = std::env::var("ASSET_ADDR").unwrap_or_else(|_| "0.0.0.0:8084".to_string());
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("Asset service listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs: state.start_time.elapsed().as_secs(),
    })
}

#[derive(Debug, Deserialize)]
struct ExportRequest {
    tree: serde_json::Value,
    format: String,
    #[serde(default = "default_resolution")]
    resolution: usize,
}

fn default_resolution() -> usize {
    128
}

async fn export_asset(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExportRequest>,
) -> Result<Json<ExportResponse>, (StatusCode, Json<serde_json::Value>)> {
    let export_id = Uuid::new_v4().to_string();

    // Forward to SDF engine for mesh generation
    let client = reqwest::Client::new();
    let engine_resp = client
        .post(format!("{}/api/v1/export", state.sdf_engine_url))
        .json(&serde_json::json!({
            "tree": req.tree,
            "format": req.format,
            "resolution": req.resolution,
        }))
        .send()
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": "SDF engine unavailable",
                    "details": e.to_string(),
                })),
            )
        })?;

    if !engine_resp.status().is_success() {
        let err = engine_resp.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Export failed",
                "details": err,
            })),
        ));
    }

    let result: serde_json::Value = engine_resp.json().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Invalid engine response",
                "details": e.to_string(),
            })),
        )
    })?;

    // Save to local storage
    let ext = match req.format.as_str() {
        "obj" => "obj",
        "stl" => "stl",
        "glb" => "glb",
        "fbx" => "fbx",
        "ply" => "ply",
        _ => "bin",
    };
    let filename = format!("{export_id}.{ext}");
    let filepath = format!("{}/{filename}", state.storage_path);

    if let Some(data_b64) = result.get("data_base64").and_then(|d| d.as_str()) {
        use base64::Engine;
        if let Ok(data) = base64::engine::general_purpose::STANDARD.decode(data_b64) {
            tokio::fs::write(&filepath, &data).await.ok();
        }
    } else if let Some(data_text) = result.get("data_text").and_then(|d| d.as_str()) {
        tokio::fs::write(&filepath, data_text.as_bytes()).await.ok();
    }

    Ok(Json(ExportResponse {
        export_id: export_id.clone(),
        format: req.format,
        status: "completed".to_string(),
        download_url: Some(format!("/api/v1/asset/download/{export_id}")),
    }))
}

async fn download_asset(
    State(state): State<Arc<AppState>>,
    Path(export_id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    // Find file by export_id prefix
    let mut entries = tokio::fs::read_dir(&state.storage_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&export_id) {
            let data = tokio::fs::read(entry.path())
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let content_type = if name.ends_with(".obj") {
                "model/obj"
            } else if name.ends_with(".stl") {
                "model/stl"
            } else if name.ends_with(".glb") {
                "model/gltf-binary"
            } else {
                "application/octet-stream"
            };

            let disposition = format!("attachment; filename=\"{name}\"");
            return Ok((
                [
                    (axum::http::header::CONTENT_TYPE, content_type.to_owned()),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        disposition,
                    ),
                ],
                data,
            ));
        }
    }

    Err(StatusCode::NOT_FOUND)
}

async fn list_formats() -> Json<FormatsResponse> {
    let formats = vec![
        fmt("OBJ", "obj", "mesh", "Wavefront OBJ - Universal mesh format"),
        fmt("STL", "stl", "mesh", "Stereolithography - 3D printing standard"),
        fmt("GLB", "glb", "mesh", "glTF Binary - Web/game engine format"),
        fmt(
            "FBX",
            "fbx",
            "mesh",
            "Filmbox - Animation/game industry standard",
        ),
        fmt(
            "USD",
            "usd",
            "mesh",
            "Universal Scene Description - VFX pipeline",
        ),
        fmt("Alembic", "abc", "mesh", "Alembic - VFX cache format"),
        fmt("PLY", "ply", "mesh", "Stanford PLY - Point cloud / mesh"),
        fmt(
            "3MF",
            "3mf",
            "mesh",
            "3D Manufacturing Format - Advanced 3D printing",
        ),
        fmt(
            "ASDF",
            "asdf",
            "sdf",
            "ALICE SDF Format - Native SDF serialization",
        ),
        fmt(
            "ASDF JSON",
            "asdf.json",
            "sdf",
            "ALICE SDF JSON - Human-readable SDF",
        ),
        fmt(
            "Nanite",
            "nanite",
            "mesh",
            "Nanite mesh - UE5 virtualized geometry",
        ),
        fmt(
            "ABM",
            "abm",
            "mesh",
            "ALICE Binary Mesh - Optimized binary format",
        ),
        fmt("WGSL", "wgsl", "shader", "WebGPU Shading Language"),
        fmt("GLSL", "glsl", "shader", "OpenGL Shading Language"),
        fmt(
            "HLSL",
            "hlsl",
            "shader",
            "High-Level Shading Language (DirectX/UE5)",
        ),
    ];

    Json(FormatsResponse {
        total: formats.len(),
        formats,
    })
}

fn fmt(name: &str, ext: &str, category: &str, desc: &str) -> FormatInfo {
    FormatInfo {
        name: name.to_string(),
        extension: ext.to_string(),
        category: category.to_string(),
        description: desc.to_string(),
    }
}
