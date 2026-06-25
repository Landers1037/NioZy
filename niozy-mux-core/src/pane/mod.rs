use alacritty_terminal::event::{Event, EventListener};
use alacritty_terminal::grid::Scroll;
use alacritty_terminal::term::Config as TermConfig;
use alacritty_terminal::term::Term;
use crate::util::TerminalSize;
use vte::ansi::Processor;

#[derive(Clone)]
pub struct NullEventProxy;

impl EventListener for NullEventProxy {
    fn send_event(&self, _event: Event) {}
}

pub struct PaneTerminal {
    pub term: Term<NullEventProxy>,
    processor: Processor,
}

impl PaneTerminal {
    pub fn new(size: &TerminalSize) -> Self {
        let config = TermConfig {
            scrolling_history: 10_000,
            ..TermConfig::default()
        };
        Self {
            term: Term::new(config, size, NullEventProxy),
            processor: Processor::new(),
        }
    }

    pub fn resize(&mut self, size: &TerminalSize) {
        self.term.resize(*size);
    }

    pub fn write_bytes(&mut self, bytes: &[u8]) {
        self.processor.advance(&mut self.term, bytes);
    }

    pub fn scroll_display(&mut self, scroll: Scroll) {
        self.term.scroll_display(scroll);
    }
}
