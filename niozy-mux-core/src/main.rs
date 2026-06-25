use anyhow::Result;
use clap::{Parser, Subcommand, ValueEnum};
use niozy_mux_core::MuxServer;
use tracing_subscriber::EnvFilter;

const DEFAULT_BIND: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 19527;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, ValueEnum)]
enum RunMode {
    #[default]
    Prod,
    Dev,
}

#[derive(Parser)]
#[command(name = "niozy-mux-core", about = "NioZy PTY multiplexer core")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Serve mux over TCP JSON-RPC
    Serve {
        #[arg(long, value_enum, default_value_t = RunMode::Prod)]
        mode: RunMode,
        #[arg(long, default_value = DEFAULT_BIND)]
        bind: String,
        #[arg(long, default_value_t = DEFAULT_PORT)]
        port: u16,
    },
}

#[cfg(windows)]
fn setup_run_mode(mode: RunMode) {
    if mode != RunMode::Dev {
        return;
    }
    unsafe {
        use windows_sys::Win32::System::Console::{AllocConsole, AttachConsole, ATTACH_PARENT_PROCESS};
        if AttachConsole(ATTACH_PARENT_PROCESS) == 0 {
            let _ = AllocConsole();
        }
    }
}

#[cfg(not(windows))]
fn setup_run_mode(_mode: RunMode) {}

fn init_tracing(mode: RunMode) -> Result<()> {
    let default = match mode {
        RunMode::Dev => "niozy_mux_core=debug",
        RunMode::Prod => "niozy_mux_core=info",
    };
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive(default.parse()?))
        .with_writer(std::io::stderr)
        .init();
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Serve { mode, bind, port } => {
            setup_run_mode(mode);
            init_tracing(mode)?;
            tracing::info!(?mode, %bind, port, "mux core starting");
            MuxServer::run_tcp(&bind, port).await?;
        }
    }
    Ok(())
}
