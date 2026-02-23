use axum::{extract::State, http::StatusCode, response::Json, routing::{get, post}, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

struct AppState { start_time: Instant }

#[derive(Serialize)]
struct Health { status: String, version: String, uptime_secs: u64, engine: String }

#[derive(Deserialize)]
struct CompileReq { tree: serde_json::Value }
#[derive(Serialize)]
struct CompileResp { success: bool, node_count: usize, depth: usize, compile_time_ms: f64 }

#[derive(Deserialize)]
struct EvalReq { tree: serde_json::Value, points: Vec<[f32; 3]>, #[serde(default = "default_mode")] mode: String }
fn default_mode() -> String { "compiled".into() }
#[derive(Serialize)]
struct EvalResp { distances: Vec<f32>, eval_time_ms: f64, point_count: usize, mode: String }

#[derive(Deserialize)]
struct ValidateReq { tree: serde_json::Value }
#[derive(Serialize)]
struct ValidateResp { valid: bool, node_count: usize, depth: usize, node_types: Vec<String>, errors: Vec<String> }

#[derive(Deserialize)]
struct MeshReq { tree: serde_json::Value, #[serde(default = "d128")] resolution: usize, #[serde(default = "d_obj")] format: String }
fn d128() -> usize { 128 }
fn d_obj() -> String { "obj".into() }
#[derive(Serialize)]
struct MeshResp { vertex_count: usize, face_count: usize, format: String, generation_time_ms: f64, #[serde(skip_serializing_if = "Option::is_none")] data_text: Option<String> }

#[derive(Deserialize)]
struct ShaderReq { tree: serde_json::Value, #[serde(default = "d_wgsl")] target: String }
fn d_wgsl() -> String { "wgsl".into() }
#[derive(Serialize)]
struct ShaderResp { target: String, source: String, transpile_time_ms: f64 }

#[derive(Serialize)]
struct Err { error: String, #[serde(skip_serializing_if = "Option::is_none")] details: Option<String> }

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "sdf_engine=info,tower_http=info".into()),
    ).init();
    let state = Arc::new(AppState { start_time: Instant::now() });
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/sdf/compile", post(compile))
        .route("/api/v1/sdf/eval", post(eval))
        .route("/api/v1/sdf/validate", post(validate))
        .route("/api/v1/mesh/generate", post(mesh_generate))
        .route("/api/v1/shader/transpile", post(shader_transpile))
        .route("/api/v1/primitives", get(list_primitives))
        .route("/api/v1/export", post(export))
        .layer(cors).layer(TraceLayer::new_for_http()).with_state(state);
    let addr = std::env::var("SDF_ENGINE_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".into());
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("SDF Engine listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}

async fn health(State(s): State<Arc<AppState>>) -> Json<Health> {
    Json(Health { status: "ok".into(), version: env!("CARGO_PKG_VERSION").into(), uptime_secs: s.start_time.elapsed().as_secs(), engine: "ALICE-SDF stub".into() })
}

fn count_nodes(t: &serde_json::Value) -> usize {
    let mut c = 1;
    for k in &["a","b","child"] { if let Some(ch) = t.get(k) { c += count_nodes(ch); } }
    if let Some(arr) = t.get("children").and_then(|v| v.as_array()) { for ch in arr { c += count_nodes(ch); } }
    c
}

fn tree_depth(t: &serde_json::Value) -> usize {
    let mut mx = 0;
    for k in &["a","b","child"] { if let Some(ch) = t.get(k) { mx = mx.max(tree_depth(ch)); } }
    if let Some(arr) = t.get("children").and_then(|v| v.as_array()) { for ch in arr { mx = mx.max(tree_depth(ch)); } }
    1 + mx
}

fn collect_types(t: &serde_json::Value) -> Vec<String> {
    let mut v = Vec::new();
    if let Some(s) = t.get("type").and_then(|x| x.as_str()) { v.push(s.into()); }
    for k in &["a","b","child"] { if let Some(ch) = t.get(k) { v.extend(collect_types(ch)); } }
    if let Some(arr) = t.get("children").and_then(|x| x.as_array()) { for ch in arr { v.extend(collect_types(ch)); } }
    v
}

async fn validate(Json(r): Json<ValidateReq>) -> Json<ValidateResp> {
    let nc = count_nodes(&r.tree); let d = tree_depth(&r.tree); let nt = collect_types(&r.tree);
    let mut errs = Vec::new();
    if r.tree.get("type").is_none() { errs.push("Root missing 'type'".into()); }
    Json(ValidateResp { valid: errs.is_empty(), node_count: nc, depth: d, node_types: nt, errors: errs })
}

async fn compile(Json(r): Json<CompileReq>) -> Result<Json<CompileResp>, (StatusCode, Json<Err>)> {
    let st = Instant::now();
    if r.tree.get("type").is_none() {
        return Err((StatusCode::BAD_REQUEST, Json(Err { error: "Missing type".into(), details: None })));
    }
    Ok(Json(CompileResp { success: true, node_count: count_nodes(&r.tree), depth: tree_depth(&r.tree), compile_time_ms: st.elapsed().as_secs_f64() * 1000.0 }))
}

async fn eval(Json(r): Json<EvalReq>) -> Result<Json<EvalResp>, (StatusCode, Json<Err>)> {
    let st = Instant::now();
    let nt = r.tree.get("type").and_then(|t| t.as_str()).unwrap_or("Sphere");
    let params = r.tree.get("params").cloned().unwrap_or(serde_json::json!({}));
    let dists: Vec<f32> = match nt {
        "Sphere" => { let rad = params.get("radius").and_then(|v| v.as_f64()).unwrap_or(1.0) as f32; r.points.iter().map(|p| (p[0]*p[0]+p[1]*p[1]+p[2]*p[2]).sqrt() - rad).collect() }
        "Box3d" => { let h = [0.5f32, 0.5, 0.5]; r.points.iter().map(|p| { let q = [p[0].abs()-h[0], p[1].abs()-h[1], p[2].abs()-h[2]]; (q[0].max(0.0).powi(2)+q[1].max(0.0).powi(2)+q[2].max(0.0).powi(2)).sqrt() + q[0].max(q[1]).max(q[2]).min(0.0) }).collect() }
        "Plane" => r.points.iter().map(|p| p[1]).collect(),
        _ => r.points.iter().map(|p| (p[0]*p[0]+p[1]*p[1]+p[2]*p[2]).sqrt() - 1.0).collect(),
    };
    let elapsed = st.elapsed();
    Ok(Json(EvalResp { point_count: dists.len(), distances: dists, eval_time_ms: elapsed.as_secs_f64()*1000.0, mode: r.mode }))
}

async fn mesh_generate(Json(r): Json<MeshReq>) -> Result<Json<MeshResp>, (StatusCode, Json<Err>)> {
    let st = Instant::now();
    let nt = r.tree.get("type").and_then(|t| t.as_str()).unwrap_or("Sphere");
    let res = r.resolution.min(64);
    let mut verts = Vec::new();
    let mut faces = Vec::new();
    let rad = r.tree.get("params").and_then(|p| p.get("radius")).and_then(|r| r.as_f64()).unwrap_or(1.0) as f32;
    for i in 0..=res { for j in 0..=res {
        let phi = std::f32::consts::PI * i as f32 / res as f32;
        let theta = 2.0 * std::f32::consts::PI * j as f32 / res as f32;
        verts.push((rad*phi.sin()*theta.cos(), rad*phi.cos(), rad*phi.sin()*theta.sin()));
    }}
    for i in 0..res { for j in 0..res {
        let a = i*(res+1)+j; let b = a+res+1;
        faces.push((a,b,a+1)); faces.push((a+1,b,b+1));
    }}
    let vc = verts.len(); let fc = faces.len();
    let obj = if r.format == "obj" {
        let mut s = format!("# AI Modeler - {nt}\n# V:{vc} F:{fc}\n");
        for v in &verts { s += &format!("v {:.6} {:.6} {:.6}\n", v.0, v.1, v.2); }
        for f in &faces { s += &format!("f {} {} {}\n", f.0+1, f.1+1, f.2+1); }
        Some(s)
    } else { None };
    Ok(Json(MeshResp { vertex_count: vc, face_count: fc, format: r.format, generation_time_ms: st.elapsed().as_secs_f64()*1000.0, data_text: obj }))
}

async fn shader_transpile(Json(r): Json<ShaderReq>) -> Result<Json<ShaderResp>, (StatusCode, Json<Err>)> {
    let st = Instant::now();
    let nt = r.tree.get("type").and_then(|t| t.as_str()).unwrap_or("Sphere");
    let src = match r.target.as_str() {
        "wgsl" => format!("// WGSL - {nt}\nfn sdf_scene(p: vec3<f32>) -> f32 {{ return length(p) - 1.0; }}\n@fragment fn fs(@location(0) wp: vec3<f32>) -> @location(0) vec4<f32> {{ let d = sdf_scene(wp); return vec4<f32>(vec3<f32>(0.5-d*0.5), 1.0); }}"),
        "glsl" => format!("// GLSL - {nt}\n#version 450\nfloat sdf(vec3 p) {{ return length(p)-1.0; }}"),
        "hlsl" => format!("// HLSL - {nt}\nfloat sdf(float3 p) {{ return length(p)-1.0; }}"),
        _ => return Err((StatusCode::BAD_REQUEST, Json(Err { error: format!("Unknown target: {}", r.target), details: None }))),
    };
    Ok(Json(ShaderResp { target: r.target, source: src, transpile_time_ms: st.elapsed().as_secs_f64()*1000.0 }))
}

async fn export(Json(r): Json<MeshReq>) -> Result<Json<MeshResp>, (StatusCode, Json<Err>)> {
    mesh_generate(Json(r)).await
}

#[derive(Serialize)]
struct PrimInfo { name: String, category: String }
#[derive(Serialize)]
struct PrimsResp { total: usize, primitives: Vec<PrimInfo>, operations: Vec<PrimInfo>, transforms: Vec<PrimInfo>, modifiers: Vec<PrimInfo> }

async fn list_primitives() -> Json<PrimsResp> {
    let p = |n: &str, c: &str| PrimInfo { name: n.into(), category: c.into() };
    let prims = vec![p("Sphere","basic"),p("Box3d","basic"),p("Cylinder","basic"),p("Torus","basic"),p("Plane","basic"),p("Capsule","basic"),p("Cone","basic"),p("RoundedBox","extended"),p("Ellipsoid","extended"),p("Pyramid","extended"),p("Octahedron","platonic"),p("Tetrahedron","platonic"),p("Gyroid","tpms"),p("SchwarzP","tpms"),p("Diamond","tpms")];
    let ops = vec![p("Union","standard"),p("Intersection","standard"),p("Subtraction","standard"),p("SmoothUnion","smooth"),p("SmoothIntersection","smooth"),p("SmoothSubtraction","smooth"),p("ChamferUnion","chamfer"),p("Xor","special"),p("Morph","special")];
    let trans = vec![p("Translate","spatial"),p("RotateEuler","spatial"),p("Scale","spatial"),p("ScaleNonUniform","spatial")];
    let mods = vec![p("Twist","deform"),p("Bend","deform"),p("Repeat","pattern"),p("RepeatFinite","pattern"),p("Mirror","pattern"),p("PolarRepeat","pattern"),p("Noise","surface"),p("Shell","surface"),p("Onion","surface")];
    let total = prims.len()+ops.len()+trans.len()+mods.len();
    Json(PrimsResp { total, primitives: prims, operations: ops, transforms: trans, modifiers: mods })
}
