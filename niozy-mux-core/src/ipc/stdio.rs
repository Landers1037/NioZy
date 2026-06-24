use crate::ipc::protocol::Event;
use anyhow::{Context, Result};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;

pub struct StdioTransport {
    out_tx: mpsc::UnboundedSender<Event>,
}

impl StdioTransport {
    pub fn new(out_tx: mpsc::UnboundedSender<Event>) -> Self {
        Self { out_tx }
    }

    pub async fn run_reader(
        request_tx: mpsc::UnboundedSender<String>,
    ) -> Result<()> {
        let stdin = tokio::io::stdin();
        let mut lines = BufReader::new(stdin).lines();
        while let Some(line) = lines.next_line().await? {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if request_tx.send(trimmed.to_string()).is_err() {
                break;
            }
        }
        Ok(())
    }

    pub async fn run_writer(mut out_rx: mpsc::UnboundedReceiver<Event>) -> Result<()> {
        let mut stdout = tokio::io::stdout();
        while let Some(event) = out_rx.recv().await {
            let json = serde_json::to_string(&event).context("serialize event")?;
            stdout.write_all(json.as_bytes()).await?;
            stdout.write_all(b"\n").await?;
            stdout.flush().await?;
        }
        Ok(())
    }

    pub fn emit(&self, event: Event) {
        let _ = self.out_tx.send(event);
    }
}
