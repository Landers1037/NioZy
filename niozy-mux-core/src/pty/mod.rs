use crate::util::TerminalSize;
use anyhow::{Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

pub struct PtyHandle {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    pub reader: Box<dyn Read + Send>,
}

pub struct PtySpawnOptions {
    pub shell: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
    pub size: TerminalSize,
}

pub fn spawn_pty(options: PtySpawnOptions) -> Result<PtyHandle> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: options.size.rows as u16,
            cols: options.size.cols as u16,
            pixel_width: 0,
            pixel_height: 0,
        })
        .context("open pty")?;

    let mut cmd = CommandBuilder::new(&options.shell);
    cmd.args(&options.args);
    if let Some(cwd) = &options.cwd {
        cmd.cwd(cwd);
    }
    for (key, value) in &options.env {
        cmd.env(key, value);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .context("spawn shell in pty")?;

    let writer = pair.master.take_writer().context("take pty writer")?;
    let reader = pair.master.try_clone_reader().context("clone pty reader")?;

    Ok(PtyHandle {
        writer: Arc::new(Mutex::new(writer)),
        child: Arc::new(Mutex::new(child)),
        reader,
    })
}

pub fn spawn_pty_reader(
    reader: Box<dyn Read + Send>,
    output_tx: mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    session_id: String,
    pane_index: u8,
) -> tokio::task::JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    if output_tx
                        .send((session_id.clone(), pane_index, buf[..n].to_vec()))
                        .is_err()
                    {
                        break;
                    }
                }
                Err(err) => {
                    tracing::warn!("pty read error: {err}");
                    break;
                }
            }
        }
    })
}

pub fn write_pty(writer: &Arc<Mutex<Box<dyn Write + Send>>>, data: &[u8]) -> Result<()> {
    let mut guard = writer.lock().expect("pty writer mutex");
    guard.write_all(data).context("write pty")?;
    guard.flush().ok();
    Ok(())
}

pub fn kill_pty(child: &Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>) -> Result<()> {
    let mut guard = child.lock().expect("pty child mutex");
    guard.kill().context("kill pty child")?;
    Ok(())
}
