use anyhow::Result;
use clap::{Parser, Subcommand};
use niozy_mux_core::MuxServer;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "niozy-mux-core", about = "NioZy PTY multiplexer core")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Serve mux over stdin/stdout (NDJSON protocol)
    Serve {
        /// Reserved for future UDS/TCP mode
        #[arg(long, default_value = "stdio")]
        transport: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("niozy_mux_core=info".parse()?))
        .with_writer(std::io::stderr)
        .init();

    let cli = Cli::parse();
    match cli.command {
        Command::Serve { transport } => {
            if transport != "stdio" {
                anyhow::bail!("only --transport stdio is supported in MVP");
            }
            MuxServer::run_stdio().await?;
        }
    }
    Ok(())
}
