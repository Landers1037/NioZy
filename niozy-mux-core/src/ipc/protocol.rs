use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Request {
    Ping {
        id: u64,
    },
    SpawnSession {
        session_id: String,
        cols: u16,
        rows: u16,
        shell: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
        #[serde(default)]
        cwd: Option<String>,
        /// Number of panes to spawn immediately (1, 2, or 4)
        #[serde(default = "default_pane_count")]
        pane_count: u8,
    },
    WriteInput {
        session_id: String,
        #[serde(default)]
        pane_index: Option<u8>,
        data_b64: String,
    },
    Resize {
        session_id: String,
        cols: u16,
        rows: u16,
    },
    SetFocus {
        session_id: String,
        pane_index: u8,
    },
    KillSession {
        session_id: String,
    },
}

fn default_pane_count() -> u8 {
    1
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    Ready,
    Pong {
        id: u64,
    },
    Output {
        session_id: String,
        data_b64: String,
        seq: u64,
    },
    CwdChanged {
        session_id: String,
        pane_index: u8,
        cwd: String,
    },
    PaneExit {
        session_id: String,
        pane_index: u8,
        code: i32,
    },
    SessionExit {
        session_id: String,
    },
    Error {
        message: String,
    },
}
