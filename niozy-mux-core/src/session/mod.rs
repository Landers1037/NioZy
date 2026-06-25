use crate::ansi::render_full_redraw;
use crate::compositor::ComposedScreen;
use crate::ipc::{
    err_response, methods, notification, ok_response, ClientHub, CwdChangedParams, IncomingRequest,
    JsonRpcError, KillSessionParams, OkResult, OutputParams, PingResult, ResizeParams, ScrollParams,
    SessionExitParams, SetFocusParams, SpawnSessionParams, SpawnSessionResult, WriteInputParams,
};
use alacritty_terminal::grid::Scroll;
use crate::layout::GridLayout;
use crate::pane::PaneTerminal;
use crate::process_job::{register_pty_child, ChildProcessJob};
use crate::pty::{kill_pty, resize_pty_master, spawn_pty, spawn_pty_reader, write_pty, PtyHandle, PtySpawnOptions};
use crate::util::cwd::extract_cwd_from_bytes;
use crate::util::TerminalSize;
use anyhow::{Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::sync::mpsc;

struct PaneRuntime {
    terminal: PaneTerminal,
    writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    _master: Box<dyn portable_pty::MasterPty + Send>,
    _reader_task: Option<tokio::task::JoinHandle<()>>,
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
        let composed = ComposedScreen::compose_from_refs(&self.layout, &refs, self.focus);
        render_full_redraw(&composed)
    }

    fn emit_output(&mut self) -> OutputParams {
        self.output_seq += 1;
        OutputParams {
            session_id: self.id.clone(),
            data_b64: BASE64.encode(self.render_current()),
            seq: self.output_seq,
        }
    }

    fn on_pane_output(&mut self, pane_index: u8, bytes: Vec<u8>, hub: &ClientHub) {
        let Some(pane) = self.panes[pane_index as usize].as_mut() else {
            return;
        };

        pane.terminal.write_bytes(&bytes);

        if let Some(cwd) = extract_cwd_from_bytes(&bytes) {
            broadcast_notification(
                hub,
                methods::CWD_CHANGED,
                CwdChangedParams {
                    session_id: self.id.clone(),
                    pane_index,
                    cwd,
                },
            );
        }

        if self.output_seq <= 3 || self.output_seq % 50 == 0 {
            tracing::debug!(
                session_id = %self.id,
                pane_index,
                seq = self.output_seq + 1,
                input_bytes = bytes.len(),
                "pane_output"
            );
        }
        let output = self.emit_output();
        broadcast_notification(hub, methods::OUTPUT, output);
    }

    fn kill_all_panes(&mut self) {
        for pane in self.panes.iter_mut().flatten() {
            if let Some(task) = pane._reader_task.take() {
                task.abort();
            }
            if let Err(err) = kill_pty(&pane.child) {
                tracing::warn!(session_id = %self.id, error = %err, "kill_pty failed");
            }
        }
        self.panes = [None, None, None, None];
    }
}

fn kill_session_panes(mut session: MuxSession, session_id: &str) {
    tracing::info!(session_id, "kill_session panes");
    session.kill_all_panes();
}

fn shutdown_all_sessions(sessions: &mut HashMap<String, MuxSession>) {
    if sessions.is_empty() {
        return;
    }
    let count = sessions.len();
    tracing::info!(count, "mux core shutting down, killing all pty sessions");
    for (session_id, session) in sessions.drain() {
        kill_session_panes(session, &session_id);
    }
}

fn broadcast_notification(hub: &ClientHub, method: &str, params: impl serde::Serialize) {
    let line = format!(
        "{}\n",
        notification(method, serde_json::to_value(params).expect("params"))
    );
    hub.broadcast(line);
}

fn start_pane_readers(
    session: &mut MuxSession,
    readers: Vec<(u8, Box<dyn std::io::Read + Send>)>,
    pane_output_tx: mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    session_id: String,
) {
    let runtime = tokio::runtime::Handle::current();
    for (pane_index, reader) in readers {
        if let Some(pane) = session.panes[pane_index as usize].as_mut() {
            pane._reader_task = Some(runtime.spawn(spawn_pty_reader(
                reader,
                pane_output_tx.clone(),
                session_id.clone(),
                pane_index,
            )));
        }
    }
}

struct SessionRegistry {
    sessions: HashMap<String, MuxSession>,
}

impl Drop for SessionRegistry {
    fn drop(&mut self) {
        shutdown_all_sessions(&mut self.sessions);
    }
}

pub struct MuxServer;

impl MuxServer {
    pub async fn run_tcp(bind: &str, port: u16) -> Result<()> {
        let bind = bind.to_string();
        let child_job = Arc::new(ChildProcessJob::new().context("create child process job")?);
        let hub = ClientHub::new();
        let (request_tx, mut request_rx) = mpsc::unbounded_channel::<IncomingRequest>();
        let hub_for_accept = hub.clone();
        tokio::spawn(crate::ipc::run_tcp_server(
            bind,
            port,
            hub_for_accept,
            request_tx,
        ));

        let mut registry = SessionRegistry {
            sessions: HashMap::new(),
        };
        let (pane_output_tx, mut pane_output_rx) =
            mpsc::unbounded_channel::<(String, u8, Vec<u8>)>();

        loop {
            tokio::select! {
                req = request_rx.recv() => {
                    let Some(incoming) = req else { break; };
                    handle_incoming_request(
                        incoming,
                        &hub,
                        &mut registry.sessions,
                        &pane_output_tx,
                        &child_job,
                    ).await;
                }
                msg = pane_output_rx.recv() => {
                    let Some((session_id, pane_index, bytes)) = msg else { continue; };
                    if let Some(session) = registry.sessions.get_mut(&session_id) {
                        session.on_pane_output(pane_index, bytes, &hub);
                    }
                }
                result = tokio::signal::ctrl_c() => {
                    match result {
                        Ok(()) => tracing::info!("shutdown signal received"),
                        Err(err) => tracing::warn!(error = %err, "shutdown signal handler failed"),
                    }
                    break;
                }
            }
        }

        tracing::info!("mux core tcp loop stopped");
        Ok(())
    }
}

async fn handle_incoming_request(
    incoming: IncomingRequest,
    hub: &Arc<ClientHub>,
    sessions: &mut HashMap<String, MuxSession>,
    pane_output_tx: &mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    child_job: &Arc<ChildProcessJob>,
) {
    let IncomingRequest {
        client_id,
        request,
        raw_id,
    } = incoming;

    let method = request.method.clone();
    let started = Instant::now();
    let response = match handle_rpc_request(
        &request.method,
        request.params,
        hub,
        sessions,
        pane_output_tx,
        child_job,
    )
    .await
    {
        Ok(result) => {
            tracing::info!(
                client_id,
                method = %method,
                elapsed_ms = started.elapsed().as_millis(),
                "rpc request ok"
            );
            ok_response(raw_id, result)
        }
        Err(err) => {
            tracing::error!(
                client_id,
                method = %method,
                elapsed_ms = started.elapsed().as_millis(),
                code = err.code,
                message = %err.message,
                "rpc request failed"
            );
            err_response(raw_id, err)
        }
    };
    hub.send_to(client_id, format!("{response}\n"));
}

async fn handle_rpc_request(
    method: &str,
    params: serde_json::Value,
    hub: &Arc<ClientHub>,
    sessions: &mut HashMap<String, MuxSession>,
    pane_output_tx: &mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    child_job: &Arc<ChildProcessJob>,
) -> std::result::Result<serde_json::Value, JsonRpcError> {
    match method {
        methods::PING => Ok(serde_json::to_value(PingResult {
            pong: true,
            api_version: crate::ipc::protocol::MUX_CORE_API_VERSION,
        })
        .unwrap()),

        methods::SPAWN_SESSION => {
            let params: SpawnSessionParams = serde_json::from_value(params)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;

            let env_keys: Vec<String> = params.env.keys().cloned().collect();
            tracing::info!(
                session_id = %params.session_id,
                cols = params.cols,
                rows = params.rows,
                pane_count = params.pane_count,
                shell = %params.shell,
                args = ?params.args,
                cwd = ?params.cwd,
                env_keys = ?env_keys,
                active_sessions = sessions.len(),
                "spawn_session start"
            );

            let session_id = params.session_id.clone();
            let cols = params.cols;
            let rows = params.rows;
            let shell = params.shell;
            let args = params.args;
            let env = params.env;
            let cwd = params.cwd;
            let pane_count = params.pane_count;

            let blocking_started = Instant::now();
            tracing::info!(session_id = %session_id, "spawn_session blocking task begin");
            let build_result = tokio::task::spawn_blocking({
                let session_id = session_id.clone();
                let shell = shell.clone();
                let args = args.clone();
                let env = env.clone();
                let cwd = cwd.clone();
                let child_job = Arc::clone(child_job);
                move || {
                    build_session(
                        session_id,
                        cols,
                        rows,
                        shell,
                        args,
                        env,
                        cwd,
                        pane_count,
                        &child_job,
                    )
                }
            })
            .await
            .map_err(|e| {
                tracing::error!(
                    elapsed_ms = blocking_started.elapsed().as_millis(),
                    error = %e,
                    "spawn_session blocking task join failed"
                );
                JsonRpcError::internal(e.to_string())
            })?;

            tracing::info!(
                elapsed_ms = blocking_started.elapsed().as_millis(),
                ok = build_result.is_ok(),
                "spawn_session blocking task end"
            );

            match build_result {
                Ok((mut session, initial, readers)) => {
                    let session_id = session.id.clone();
                    let pane_count = session.layout.active_count;
                    start_pane_readers(
                        &mut session,
                        readers,
                        pane_output_tx.clone(),
                        session_id.clone(),
                    );
                    sessions.insert(session_id.clone(), session);
                    broadcast_notification(hub, methods::OUTPUT, initial);
                    tracing::info!(
                        session_id = %session_id,
                        pane_count,
                        total_sessions = sessions.len(),
                        "spawn_session rpc ok"
                    );
                    Ok(serde_json::to_value(SpawnSessionResult {
                        session_id,
                        pane_count,
                    })
                    .unwrap())
                }
                Err(err) => {
                    tracing::error!(
                        error = %err,
                        "spawn_session build failed"
                    );
                    Err(JsonRpcError::internal(err.to_string()))
                }
            }
        }

        methods::WRITE_INPUT => {
            let params: WriteInputParams = serde_json::from_value(params)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;
            let data = BASE64
                .decode(&params.data_b64)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;
            let session = sessions
                .get(&params.session_id)
                .ok_or_else(|| JsonRpcError::internal("unknown session"))?;
            let index = params.pane_index.unwrap_or(session.focus);
            let pane = session.panes[index as usize]
                .as_ref()
                .ok_or_else(|| JsonRpcError::internal("pane not active"))?;
            write_pty(&pane.writer, &data).map_err(|e| JsonRpcError::internal(e.to_string()))?;
            Ok(serde_json::to_value(OkResult { ok: true }).unwrap())
        }

        methods::RESIZE => {
            let params: ResizeParams = serde_json::from_value(params)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;
            if let Some(session) = sessions.get_mut(&params.session_id) {
                session.layout =
                    GridLayout::compute(params.cols, params.rows, session.layout.active_count);
                for i in 0..session.layout.active_count {
                    let size = session.layout.pane_size(i);
                    if let Some(pane) = session.panes[i as usize].as_mut() {
                        pane.terminal.resize(&size);
                        if let Err(err) = resize_pty_master(pane._master.as_ref(), &size) {
                            tracing::warn!(
                                session_id = %params.session_id,
                                pane_index = i,
                                error = %err,
                                "resize pty failed"
                            );
                        }
                    }
                }
                let output = session.emit_output();
                broadcast_notification(hub, methods::OUTPUT, output);
            }
            Ok(serde_json::to_value(OkResult { ok: true }).unwrap())
        }

        methods::SET_FOCUS => {
            let params: SetFocusParams = serde_json::from_value(params)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;
            if let Some(session) = sessions.get_mut(&params.session_id) {
                session.focus = params.pane_index;
                let output = session.emit_output();
                broadcast_notification(hub, methods::OUTPUT, output);
            }
            Ok(serde_json::to_value(OkResult { ok: true }).unwrap())
        }

        methods::SCROLL => {
            let params: ScrollParams = serde_json::from_value(params)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;
            if let Some(session) = sessions.get_mut(&params.session_id) {
                let index = params.pane_index.unwrap_or(session.focus);
                if let Some(pane) = session.panes[index as usize].as_mut() {
                    pane.terminal.scroll_display(Scroll::Delta(params.delta));
                    let output = session.emit_output();
                    broadcast_notification(hub, methods::OUTPUT, output);
                }
            }
            Ok(serde_json::to_value(OkResult { ok: true }).unwrap())
        }

        methods::KILL_SESSION => {
            let params: KillSessionParams = serde_json::from_value(params)
                .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?;
            tracing::info!(session_id = %params.session_id, "kill_session");
            if let Some(session) = sessions.remove(&params.session_id) {
                kill_session_panes(session, &params.session_id);
                broadcast_notification(
                    hub,
                    methods::SESSION_EXIT,
                    SessionExitParams {
                        session_id: params.session_id,
                    },
                );
            }
            Ok(serde_json::to_value(OkResult { ok: true }).unwrap())
        }

        _ => Err(JsonRpcError::method_not_found(method)),
    }
}

fn build_session(
    session_id: String,
    cols: u16,
    rows: u16,
    shell: String,
    args: Vec<String>,
    env: HashMap<String, String>,
    cwd: Option<String>,
    pane_count: u8,
    child_job: &Arc<ChildProcessJob>,
) -> anyhow::Result<(MuxSession, OutputParams, Vec<(u8, Box<dyn std::io::Read + Send>)>)> {
    let pane_count = pane_count.clamp(1, 4);
    let layout = GridLayout::compute(cols, rows, pane_count);
    let mut session = MuxSession::new(session_id.clone(), layout.clone());

    let pane_count = layout.active_count;
    let mut spawned: Vec<(u8, PtyHandle)> = Vec::with_capacity(pane_count as usize);
    let mut pending_readers: Vec<(u8, Box<dyn std::io::Read + Send>)> =
        Vec::with_capacity(pane_count as usize);

    if pane_count == 1 {
        let size = layout.pane_size(0);
        let opts = PtySpawnOptions {
            shell: shell.clone(),
            args: args.clone(),
            env: env.clone(),
            cwd: cwd.clone(),
            size,
        };
        tracing::info!(
            session_id = %session_id,
            pane_index = 0,
            shell = %shell,
            args = ?args,
            cwd = ?cwd,
            "spawn_pty begin"
        );
        let handle = spawn_pty(opts).map_err(|err| {
            tracing::error!(
                session_id = %session_id,
                pane_index = 0,
                error = %err,
                "spawn_pty failed"
            );
            err
        })?;
        tracing::info!(session_id = %session_id, pane_index = 0, "spawn_pty ok");
        register_pty_child(child_job, &handle.child);
        spawned.push((0, handle));
    } else {
        std::thread::scope(|scope| {
            let mut handles = Vec::with_capacity(pane_count as usize);
            for pane_index in 0..pane_count {
                let size = layout.pane_size(pane_index);
                let opts = PtySpawnOptions {
                    shell: shell.clone(),
                    args: args.clone(),
                    env: env.clone(),
                    cwd: cwd.clone(),
                    size,
                };
                let session_id = session_id.clone();
                let shell_name = shell.clone();
                handles.push(scope.spawn(move || {
                    tracing::info!(
                        session_id = %session_id,
                        pane_index,
                        shell = %shell_name,
                        "spawn_pty begin"
                    );
                    let result = spawn_pty(opts);
                    if result.is_ok() {
                        tracing::info!(session_id = %session_id, pane_index, "spawn_pty ok");
                    }
                    (pane_index, result)
                }));
            }
            for handle in handles {
                let (pane_index, result) = handle
                    .join()
                    .map_err(|_| anyhow::anyhow!("pane spawn thread panicked"))?;
                spawned.push((pane_index, result?));
            }
            for (pane_index, handle) in &spawned {
                register_pty_child(child_job, &handle.child);
                let _ = pane_index;
            }
            Ok::<(), anyhow::Error>(())
        })?;
    }

    spawned.sort_by_key(|(idx, _)| *idx);

    for (pane_index, handle) in spawned {
        let size = layout.pane_size(pane_index);
        pending_readers.push((pane_index, handle.reader));

        session.panes[pane_index as usize] = Some(PaneRuntime {
            terminal: PaneTerminal::new(&size),
            writer: handle.writer,
            child: handle.child,
            _master: handle.master,
            _reader_task: None,
        });
    }

    session.output_seq = 1;
    let initial = OutputParams {
        session_id: session_id.clone(),
        data_b64: BASE64.encode(session.render_current()),
        seq: session.output_seq,
    };

    tracing::info!(
        session_id = %session_id,
        pane_count = layout.active_count,
        cols,
        rows,
        initial_bytes = initial.data_b64.len(),
        "spawn_session done"
    );

    Ok((session, initial, pending_readers))
}
