use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// JSON-RPC method params / notification payloads (camelCase).

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnSessionParams {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
    pub shell: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default = "default_pane_count")]
    pub pane_count: u8,
}

fn default_pane_count() -> u8 {
    1
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnSessionResult {
    pub session_id: String,
    pub pane_count: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteInputParams {
    pub session_id: String,
    #[serde(default)]
    pub pane_index: Option<u8>,
    pub data_b64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeParams {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetFocusParams {
    pub session_id: String,
    pub pane_index: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KillSessionParams {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
pub struct OkResult {
    pub ok: bool,
}

#[derive(Debug, Serialize)]
pub struct PingResult {
    pub pong: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadyParams {
    pub version: &'static str,
    pub port: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputParams {
    pub session_id: String,
    pub data_b64: String,
    pub seq: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CwdChangedParams {
    pub session_id: String,
    pub pane_index: u8,
    pub cwd: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaneExitParams {
    pub session_id: String,
    pub pane_index: u8,
    pub code: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionExitParams {
    pub session_id: String,
}

pub mod methods {
    pub const READY: &str = "mux.ready";
    pub const PING: &str = "mux.ping";
    pub const SPAWN_SESSION: &str = "mux.spawnSession";
    pub const WRITE_INPUT: &str = "mux.writeInput";
    pub const RESIZE: &str = "mux.resize";
    pub const SET_FOCUS: &str = "mux.setFocus";
    pub const KILL_SESSION: &str = "mux.killSession";
    pub const OUTPUT: &str = "mux.output";
    pub const CWD_CHANGED: &str = "mux.cwdChanged";
    pub const PANE_EXIT: &str = "mux.paneExit";
    pub const SESSION_EXIT: &str = "mux.sessionExit";
}
