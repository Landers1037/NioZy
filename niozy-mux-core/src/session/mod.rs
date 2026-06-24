use crate::ansi::render_full_redraw;
use crate::compositor::ComposedScreen;
use crate::ipc::protocol::{Event, Request};
use crate::ipc::StdioTransport;
use crate::layout::GridLayout;
use crate::pane::PaneTerminal;
use crate::pty::{kill_pty, spawn_pty, spawn_pty_reader, write_pty, PtySpawnOptions};
use crate::util::cwd::extract_cwd_from_bytes;
use crate::util::TerminalSize;
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

struct PaneRuntime {
    terminal: PaneTerminal,
    writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    _reader_task: tokio::task::JoinHandle<()>,
}

struct MuxSession {
    id: String,
    layout: GridLayout,
    panes: [Option<PaneRuntime>; 4],
    focus: u8,
    output_seq: u64,
}

impl MuxSession {
    fn new(id: String, layout: GridLayout) -> Self {
        Self {
            id,
            layout,
            panes: [None, None, None, None],
            focus: 0,
            output_seq: 0,
        }
    }

    fn pane_refs(&self) -> [&PaneTerminal; 4] {
        static EMPTY: std::sync::OnceLock<[PaneTerminal; 4]> = std::sync::OnceLock::new();
        let empty = EMPTY.get_or_init(|| {
            [
                PaneTerminal::new(&TerminalSize::new(1, 1)),
                PaneTerminal::new(&TerminalSize::new(1, 1)),
                PaneTerminal::new(&TerminalSize::new(1, 1)),
                PaneTerminal::new(&TerminalSize::new(1, 1)),
            ]
        });
        [
            self.panes[0]
                .as_ref()
                .map(|p| &p.terminal)
                .unwrap_or(&empty[0]),
            self.panes[1]
                .as_ref()
                .map(|p| &p.terminal)
                .unwrap_or(&empty[1]),
            self.panes[2]
                .as_ref()
                .map(|p| &p.terminal)
                .unwrap_or(&empty[2]),
            self.panes[3]
                .as_ref()
                .map(|p| &p.terminal)
                .unwrap_or(&empty[3]),
        ]
    }

    fn render_current(&self) -> Vec<u8> {
        let refs = self.pane_refs();
        let composed = ComposedScreen::compose_from_refs(&self.layout, &refs);
        render_full_redraw(&composed)
    }

    fn on_pane_output(&mut self, pane_index: u8, bytes: Vec<u8>) -> Vec<Event> {
        let mut events = Vec::new();
        let Some(pane) = self.panes[pane_index as usize].as_mut() else {
            return events;
        };

        pane.terminal.write_bytes(&bytes);

        if let Some(cwd) = extract_cwd_from_bytes(&bytes) {
            events.push(Event::CwdChanged {
                session_id: self.id.clone(),
                pane_index,
                cwd,
            });
        }

        self.output_seq += 1;
        let rendered = self.render_current();
        if self.output_seq <= 3 || self.output_seq % 50 == 0 {
            tracing::debug!(
                session_id = %self.id,
                pane_index,
                seq = self.output_seq,
                input_bytes = bytes.len(),
                output_bytes = rendered.len(),
                "pane_output"
            );
        }
        events.push(Event::Output {
            session_id: self.id.clone(),
            data_b64: BASE64.encode(rendered),
            seq: self.output_seq,
        });
        events
    }
}

pub struct MuxServer;

impl MuxServer {
    pub async fn run_stdio() -> Result<()> {
        let (event_tx, event_rx) = mpsc::unbounded_channel::<Event>();
        let (request_tx, mut request_rx) = mpsc::unbounded_channel::<String>();

        let transport = StdioTransport::new(event_tx.clone());
        transport.emit(Event::Ready);

        let reader = tokio::spawn(StdioTransport::run_reader(request_tx));
        let writer = tokio::spawn(StdioTransport::run_writer(event_rx));

        let transport_for_loop = StdioTransport::new(event_tx);

        let mut sessions: HashMap<String, MuxSession> = HashMap::new();
        let (pane_output_tx, mut pane_output_rx) = mpsc::unbounded_channel::<(String, u8, Vec<u8>)>();

        loop {
            tokio::select! {
                line = request_rx.recv() => {
                    let Some(line) = line else { break; };
                    if let Err(err) = handle_request_line(
                        &line,
                        &transport_for_loop,
                        &mut sessions,
                        &pane_output_tx,
                    ) {
                        transport_for_loop.emit(Event::Error { message: err.to_string() });
                    }
                }
                msg = pane_output_rx.recv() => {
                    let Some((session_id, pane_index, bytes)) = msg else { continue; };
                    if let Some(session) = sessions.get_mut(&session_id) {
                        for event in session.on_pane_output(pane_index, bytes) {
                            transport_for_loop.emit(event);
                        }
                    }
                }
                else => break,
            }
        }

        reader.abort();
        writer.abort();
        Ok(())
    }
}

fn handle_request_line(
    line: &str,
    transport: &StdioTransport,
    sessions: &mut HashMap<String, MuxSession>,
    pane_output_tx: &mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
) -> Result<()> {
    let request: Request = serde_json::from_str(line).context("parse request")?;
    match request {
        Request::Ping { id } => transport.emit(Event::Pong { id }),
        Request::SpawnSession {
            session_id,
            cols,
            rows,
            shell,
            args,
            env,
            cwd,
            pane_count,
        } => spawn_session(
            sessions,
            pane_output_tx,
            transport,
            session_id,
            cols,
            rows,
            shell,
            args,
            env,
            cwd,
            pane_count,
        )?,
        Request::WriteInput {
            session_id,
            pane_index,
            data_b64,
        } => {
            let data = BASE64.decode(data_b64).context("decode input")?;
            let session = sessions.get(&session_id).context("unknown session")?;
            let index = pane_index.unwrap_or(session.focus);
            let pane = session.panes[index as usize]
                .as_ref()
                .context("pane not active")?;
            write_pty(&pane.writer, &data)?;
        }
        Request::Resize {
            session_id,
            cols,
            rows,
        } => {
            if let Some(session) = sessions.get_mut(&session_id) {
                session.layout = GridLayout::compute(cols, rows, session.layout.active_count);
                for i in 0..session.layout.active_count {
                    let size = session.layout.pane_size(i);
                    if let Some(pane) = session.panes[i as usize].as_mut() {
                        pane.terminal.resize(&size);
                    }
                }
                session.output_seq += 1;
                transport.emit(Event::Output {
                    session_id,
                    data_b64: BASE64.encode(session.render_current()),
                    seq: session.output_seq,
                });
            }
        }
        Request::SetFocus {
            session_id,
            pane_index,
        } => {
            if let Some(session) = sessions.get_mut(&session_id) {
                session.focus = pane_index;
            }
        }
        Request::KillSession { session_id } => {
            if let Some(session) = sessions.remove(&session_id) {
                for pane in session.panes.into_iter().flatten() {
                    let _ = kill_pty(&pane.child);
                }
                transport.emit(Event::SessionExit { session_id });
            }
        }
    }
    Ok(())
}

fn spawn_session(
    sessions: &mut HashMap<String, MuxSession>,
    pane_output_tx: &mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    transport: &StdioTransport,
    session_id: String,
    cols: u16,
    rows: u16,
    shell: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: Option<String>,
    pane_count: u8,
) -> Result<()> {
    tracing::info!(
        session_id = %session_id,
        cols,
        rows,
        pane_count,
        shell = %shell,
        "spawn_session start"
    );
    let layout = GridLayout::compute(cols, rows, pane_count);
    let mut session = MuxSession::new(session_id.clone(), layout.clone());

    for pane_index in 0..layout.active_count {
        let size = layout.pane_size(pane_index);
        let handle = spawn_pty(PtySpawnOptions {
            shell: shell.clone(),
            args: args.clone(),
            env: env.clone(),
            cwd: cwd.clone(),
            size,
        })?;

        let reader_task = spawn_pty_reader(
            handle.reader,
            pane_output_tx.clone(),
            session_id.clone(),
            pane_index,
        );

        session.panes[pane_index as usize] = Some(PaneRuntime {
            terminal: PaneTerminal::new(&size),
            writer: handle.writer,
            child: handle.child,
            _reader_task: reader_task,
        });
    }

    session.output_seq = 1;
    let initial = session.render_current();
    tracing::info!(
        session_id = %session_id,
        pane_count = layout.active_count,
        cols,
        rows,
        initial_bytes = initial.len(),
        "spawn_session done"
    );
    transport.emit(Event::Output {
        session_id: session_id.clone(),
        data_b64: BASE64.encode(initial),
        seq: session.output_seq,
    });
    sessions.insert(session_id, session);
    Ok(())
}
