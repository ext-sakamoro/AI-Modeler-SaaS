use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::{Json, IntoResponse},
    routing::{get, post},
    Router,
};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use uuid::Uuid;

struct AppState {
    sessions: DashMap<String, SessionState>,
    start_time: std::time::Instant,
}

struct SessionState {
    project_id: String,
    tx: broadcast::Sender<String>,
    participant_count: std::sync::atomic::AtomicUsize,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_secs: u64,
    active_sessions: usize,
}

#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    project_id: String,
}

#[derive(Debug, Serialize)]
struct CreateSessionResponse {
    session_id: String,
    project_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CollabMessage {
    #[serde(rename = "type")]
    msg_type: String,
    user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    patch: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<serde_json::Value>,
    timestamp: u64,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "collab_service=info".into()),
        )
        .init();

    let state = Arc::new(AppState {
        sessions: DashMap::new(),
        start_time: std::time::Instant::now(),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/collab/sessions", post(create_session))
        .route("/api/v1/collab/sessions/:session_id", get(get_session_info))
        .route("/ws/collab/:session_id", get(ws_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = std::env::var("COLLAB_ADDR").unwrap_or_else(|_| "0.0.0.0:8083".to_string());
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tracing::info!("Collab service listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs: state.start_time.elapsed().as_secs(),
        active_sessions: state.sessions.len(),
    })
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSessionRequest>,
) -> Json<CreateSessionResponse> {
    let session_id = Uuid::new_v4().to_string();
    let (tx, _) = broadcast::channel(256);

    state.sessions.insert(
        session_id.clone(),
        SessionState {
            project_id: req.project_id.clone(),
            tx,
            participant_count: std::sync::atomic::AtomicUsize::new(0),
        },
    );

    Json(CreateSessionResponse {
        session_id,
        project_id: req.project_id,
    })
}

async fn get_session_info(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    state
        .sessions
        .get(&session_id)
        .map(|s| {
            Json(serde_json::json!({
                "session_id": session_id,
                "project_id": s.project_id,
                "participants": s.participant_count.load(std::sync::atomic::Ordering::Relaxed),
            }))
        })
        .ok_or(axum::http::StatusCode::NOT_FOUND)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state, session_id))
}

async fn handle_ws(socket: WebSocket, state: Arc<AppState>, session_id: String) {
    let session = match state.sessions.get(&session_id) {
        Some(s) => s,
        None => return,
    };

    let tx = session.tx.clone();
    let mut rx = tx.subscribe();
    session
        .participant_count
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    drop(session);

    let (mut sender, mut receiver) = socket.split();

    // Broadcast received messages to all participants
    let tx_clone = tx.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                // Validate and normalize message structure
                if let Ok(parsed) = serde_json::from_str::<CollabMessage>(&text) {
                    let normalized = serde_json::to_string(&parsed).unwrap_or_else(|_| text.to_string());
                    let _ = tx_clone.send(normalized);
                } else {
                    let _ = tx_clone.send(text.to_string());
                }
            }
        }
    });

    // Send broadcast messages to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    tokio::select! {
        _ = recv_task => {},
        _ = send_task => {},
    }

    if let Some(session) = state.sessions.get(&session_id) {
        session
            .participant_count
            .fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }
}
