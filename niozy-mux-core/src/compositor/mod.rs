use alacritty_terminal::term::cell::Cell;
use alacritty_terminal::vte::ansi::Color;
use crate::layout::GridLayout;
use crate::pane::PaneTerminal;

#[derive(Debug, Clone)]
pub struct ComposedCell {
    pub ch: char,
    pub fg: Color,
    pub bg: Color,
    pub bold: bool,
    pub italic: bool,
    pub inverse: bool,
}

pub struct ComposedScreen {
    pub cols: usize,
    pub rows: usize,
    pub cells: Vec<ComposedCell>,
}

impl ComposedScreen {
    pub fn compose_from_refs(layout: &GridLayout, panes: &[&PaneTerminal; 4]) -> Self {
        let cols = layout.screen.cols;
        let rows = layout.screen.rows;
        let default = ComposedCell {
            ch: ' ',
            fg: Color::Named(alacritty_terminal::vte::ansi::NamedColor::Foreground),
            bg: Color::Named(alacritty_terminal::vte::ansi::NamedColor::Background),
            bold: false,
            italic: false,
            inverse: false,
        };
        let mut cells = vec![default; cols * rows];

        for pane_index in 0..layout.active_count {
            let rect = layout.panes[pane_index as usize];
            let pane = panes[pane_index as usize];
            for (idx, cell) in pane.term.grid().display_iter().enumerate() {
                let local_col = idx % rect.cols;
                let local_row = idx / rect.cols;
                if local_row >= rect.rows {
                    break;
                }
                let global_col = rect.col + local_col;
                let global_row = rect.row + local_row;
                if global_col >= cols || global_row >= rows {
                    continue;
                }
                cells[global_row * cols + global_col] = composed_from_cell(&cell);
            }
        }

        Self { cols, rows, cells }
    }
}

fn composed_from_cell(cell: &Cell) -> ComposedCell {
    use alacritty_terminal::term::cell::Flags;
    ComposedCell {
        ch: cell.c,
        fg: cell.fg,
        bg: cell.bg,
        bold: cell.flags.contains(Flags::BOLD),
        italic: cell.flags.contains(Flags::ITALIC),
        inverse: cell.flags.contains(Flags::INVERSE),
    }
}
