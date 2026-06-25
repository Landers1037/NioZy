use crate::ipc::jsonrpc::{notification, JsonRpcRequest};
use crate::ipc::protocol::{methods, ReadyParams};
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

pub type ClientId = u64;

pub struct ClientHub {
    next_id: AtomicU64,
    clients: Mutex<HashMap<ClientId, mpsc::UnboundedSender<String>>>,
}

impl ClientHub {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            next_id: AtomicU64::new(1),
            clients: Mutex::new(HashMap::new()),
        })
    }

    fn register_client(&self) -> (ClientId, mpsc::UnboundedReceiver<String>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::unbounded_channel();
        self.clients.lock().expect("client hub lock").insert(id, tx);
        (id, rx)
    }

    fn unregister(&self, id: ClientId) {
        self.clients.lock().expect("client hub lock").remove(&id);
    }

    pub fn send_to(&self, id: ClientId, line: String) {
        if let Some(tx) = self.clients.lock().expect("client hub lock").get(&id) {
            let _ = tx.send(line);
        }
    }

    pub fn broadcast(&self, line: String) {
        let clients = self.clients.lock().expect("client hub lock");
        for tx in clients.values() {
            let _ = tx.send(line.clone());
        }
    }
}

pub struct IncomingRequest {
    pub client_id: ClientId,
    pub request: JsonRpcRequest,
    pub raw_id: serde_json::Value,
}

pub async fn run_tcp_server(
    bind: String,
    port: u16,
    hub: Arc<ClientHub>,
    request_tx: mpsc::UnboundedSender<IncomingRequest>,
) -> Result<()> {
    let addr = format!("{bind}:{port}");
    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(%addr, "mux TCP JSON-RPC listening");

    loop {
        let (stream, peer) = listener.accept().await.context("accept")?;
        tracing::info!(%peer, "client connected");
        let hub = hub.clone();
        let request_tx = request_tx.clone();
        tokio::spawn(async move {
            if let Err(err) = handle_client(stream, hub, request_tx, port).await {
                tracing::warn!(%peer, error = %err, "client disconnected with error");
            } else {
                tracing::info!(%peer, "client disconnected");
            }
        });
    }
}

async fn handle_client(
    stream: TcpStream,
    hub: Arc<ClientHub>,
    request_tx: mpsc::UnboundedSender<IncomingRequest>,
    port: u16,
) -> Result<()> {
    let (read_half, write_half) = stream.into_split();
    let (client_id, mut out_rx) = hub.register_client();

    let ready = notification(
        methods::READY,
        serde_json::to_value(ReadyParams {
            version: env!("CARGO_PKG_VERSION"),
            port,
        })?,
    );
    hub.send_to(client_id, format!("{ready}\n"));

    let writer_task = tokio::spawn(async move {
        let mut writer = write_half;
        while let Some(line) = out_rx.recv().await {
            if writer.write_all(line.as_bytes()).await.is_err() {
                break;
            }
            if writer.flush().await.is_err() {
                break;
            }
        }
    });

    let mut lines = BufReader::new(read_half).lines();
    while let Some(line) = lines.next_line().await? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let request: JsonRpcRequest = match serde_json::from_str(trimmed) {
            Ok(req) => req,
            Err(err) => {
                tracing::warn!(error = %err, "invalid JSON-RPC request");
                continue;
            }
        };
        if request.jsonrpc != "2.0" {
            continue;
        }
        if request.id.is_none() {
            continue;
        }
        tracing::info!(
            client_id,
            method = %request.method,
            id = ?request.id,
            "rpc request received"
        );
        let raw_id = request.id.clone().unwrap_or(serde_json::Value::Null);
        if request_tx
            .send(IncomingRequest {
                client_id,
                request,
                raw_id,
            })
            .is_err()
        {
            break;
        }
    }

    hub.unregister(client_id);
    writer_task.abort();
    Ok(())
}
