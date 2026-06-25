use crate::util::TerminalSize;
use anyhow::{Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

/// Windows ConPTY 偶发在 openpty/spawn_command 上无限阻塞；超时后返回错误而非挂死 core。
const SPAWN_PTY_TIMEOUT: Duration = Duration::from_secs(45);

pub struct PtyHandle {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    pub reader: Box<dyn Read + Send>,
    /// ConPTY master 须与子进程同生命周期；函数返回时 drop 会阻塞数十秒（见 portable-pty whoami 示例）。
    pub master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct PtySpawnOptions {
    pub shell: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
    pub size: TerminalSize,
}

pub fn spawn_pty(options: PtySpawnOptions) -> Result<PtyHandle> {
    spawn_pty_with_timeout(options, SPAWN_PTY_TIMEOUT)
}

pub fn spawn_pty_with_timeout(options: PtySpawnOptions, timeout: Duration) -> Result<PtyHandle> {
    log_spawn_options(&options);
    #[cfg(windows)]
    log_daemon_env_snapshot();

    let shell = options.shell.clone();
    let shell_for_thread = shell.clone();
    let wait_started = Instant::now();
    tracing::info!(
        shell = %shell,
        timeout_secs = timeout.as_secs(),
        "pty spawn waiting for background thread"
    );

    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    std::thread::spawn(move || {
        let result = spawn_pty_inner(options);
        if let Err(ref err) = result {
            tracing::error!(shell = %shell_for_thread, error = %err, "pty spawn inner failed");
        }
        let _ = tx.send(result);
    });

    match rx.recv_timeout(timeout) {
        Ok(result) => {
            let elapsed_ms = wait_started.elapsed().as_millis();
            match &result {
                Ok(_) => tracing::info!(shell = %shell, elapsed_ms, "pty spawn completed"),
                Err(err) => tracing::error!(shell = %shell, elapsed_ms, error = %err, "pty spawn returned error"),
            }
            result
        }
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
            tracing::error!(
                shell = %shell,
                elapsed_ms = wait_started.elapsed().as_millis(),
                timeout_secs = timeout.as_secs(),
                hint = "若已有 pty handles ready，多为 PtyPair 析构顺序错误（spawn 后须 drop slave、保留 master 至 session 结束）",
                "PTY spawn timed out waiting for spawn thread"
            );
            anyhow::bail!(
                "PTY spawn timed out after {}s (portable-pty spawn thread did not return)",
                timeout.as_secs()
            )
        }
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
            tracing::error!(shell = %shell, "PTY spawn thread exited without result");
            anyhow::bail!("PTY spawn thread exited without result")
        }
    }
}

fn log_spawn_options(options: &PtySpawnOptions) {
    let env_keys: Vec<&str> = options.env.keys().map(String::as_str).collect();
    tracing::info!(
        shell = %options.shell,
        args = ?options.args,
        cwd = ?options.cwd,
        cols = options.size.cols,
        rows = options.size.rows,
        env_keys = ?env_keys,
        "pty spawn options"
    );
}

#[cfg(windows)]
fn log_daemon_env_snapshot() {
    let path_len = std::env::var("PATH")
        .or_else(|_| std::env::var("Path"))
        .map(|p| p.len())
        .unwrap_or(0);
    tracing::info!(
        path_len,
        system_root = ?std::env::var("SystemRoot").ok(),
        com_spec = ?std::env::var("ComSpec").ok(),
        userprofile = ?std::env::var("USERPROFILE").ok(),
        "daemon env snapshot"
    );
}

fn spawn_pty_inner(options: PtySpawnOptions) -> Result<PtyHandle> {
    let step_started = Instant::now();
    let pty_system = native_pty_system();
    tracing::info!(
        shell = %options.shell,
        cols = options.size.cols,
        rows = options.size.rows,
        "openpty begin"
    );
    let pair = pty_system
        .openpty(PtySize {
            rows: options.size.rows as u16,
            cols: options.size.cols as u16,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| {
            tracing::error!(shell = %options.shell, error = %err, "openpty failed");
            err
        })
        .context("open pty")?;
    tracing::info!(
        shell = %options.shell,
        elapsed_ms = step_started.elapsed().as_millis(),
        "openpty ok"
    );

    let mut cmd = CommandBuilder::new(&options.shell);
    #[cfg(windows)]
    {
        // 保留 daemon 继承的系统 env；env_clear + interactive shell 易触发 CreateProcessW 45s 超时
        cmd.set_controlling_tty(false);
        cmd.args(&options.args);
        if let Some(cwd) = &options.cwd {
            cmd.cwd(cwd);
        }
        for (key, value) in &options.env {
            if key.contains('\0') || value.contains('\0') {
                continue;
            }
            cmd.env(key, value);
        }
        propagate_minimal_windows_env(&mut cmd, &options.env);
    }
    #[cfg(not(windows))]
    {
        cmd.env_clear();
        cmd.set_controlling_tty(false);
        cmd.args(&options.args);
        if let Some(cwd) = &options.cwd {
            cmd.cwd(cwd);
        }
        for (key, value) in &options.env {
            if key.contains('\0') || value.contains('\0') {
                continue;
            }
            cmd.env(key, value);
        }
        propagate_minimal_windows_env(&mut cmd, &options.env);
    }

    let spawn_started = Instant::now();
    tracing::info!(
        shell = %options.shell,
        args = ?options.args,
        cwd = ?options.cwd,
        "spawn_command begin"
    );
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|err| {
            tracing::error!(
                shell = %options.shell,
                elapsed_ms = spawn_started.elapsed().as_millis(),
                error = %err,
                "spawn_command failed"
            );
            err
        })
        .context("spawn shell in pty")?;
    tracing::info!(
        shell = %options.shell,
        elapsed_ms = spawn_started.elapsed().as_millis(),
        total_ms = step_started.elapsed().as_millis(),
        "spawn_command ok"
    );

    // portable-pty 官方示例：spawn 后立即释放 slave，否则 Windows ConPTY 析构会阻塞 spawn 线程。
    drop(pair.slave);
    tracing::info!(shell = %options.shell, "pty slave released");

    let writer = pair.master.take_writer().context("take pty writer")?;
    let reader = pair.master.try_clone_reader().context("clone pty reader")?;
    let master = pair.master;
    tracing::info!(
        shell = %options.shell,
        total_ms = step_started.elapsed().as_millis(),
        "pty handles ready"
    );

    Ok(PtyHandle {
        writer: Arc::new(Mutex::new(writer)),
        child: Arc::new(Mutex::new(child)),
        reader,
        master,
    })
}

#[cfg(windows)]
fn propagate_minimal_windows_env(cmd: &mut CommandBuilder, overrides: &HashMap<String, String>) {
    const KEYS: &[&str] = &[
        "SystemRoot",
        "WINDIR",
        "ComSpec",
        "PATHEXT",
        "PATH",
        "Path",
        "USERPROFILE",
        "HOMEDRIVE",
        "HOMEPATH",
        "APPDATA",
        "LOCALAPPDATA",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "SYSTEMDRIVE",
        "TEMP",
        "TMP",
        "USERNAME",
    ];
    for key in KEYS {
        if overrides.contains_key(*key) {
            continue;
        }
        if let Ok(val) = std::env::var(key) {
            if !val.contains('\0') {
                cmd.env(key, val);
            }
        }
    }
}

#[cfg(not(windows))]
fn propagate_minimal_windows_env(_cmd: &mut CommandBuilder, _overrides: &HashMap<String, String>) {}

pub fn spawn_pty_reader(
    reader: Box<dyn Read + Send>,
    output_tx: mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    session_id: String,
    pane_index: u8,
) -> impl std::future::Future<Output = ()> + Send {
    async move {
        let _ = tokio::task::spawn_blocking(move || {
            read_pty_loop(reader, output_tx, session_id, pane_index)
        })
        .await;
    }
}

fn read_pty_loop(
    mut reader: Box<dyn Read + Send>,
    output_tx: mpsc::UnboundedSender<(String, u8, Vec<u8>)>,
    session_id: String,
    pane_index: u8,
) {
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
