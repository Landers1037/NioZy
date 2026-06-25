use alacritty_terminal::term::cell::Cell;
use alacritty_terminal::vte::ansi::{Color, NamedColor};
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
    pub fn compose_from_refs(
        layout: &GridLayout,
        panes: &[&PaneTerminal; 4],
        focus_pane: u8,
    ) -> Self {
        let cols = layout.screen.cols;
        let rows = layout.screen.rows;
        let default = ComposedCell {
            ch: ' ',
            fg: Color::Named(NamedColor::Foreground),
            bg: Color::Named(NamedColor::Background),
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

        draw_pane_borders(&mut cells, layout, focus_pane);

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

fn draw_pane_borders(cells: &mut [ComposedCell], layout: &GridLayout, focus_pane: u8) {
    if layout.active_count <= 1 {
        return;
    }

    let cols = layout.screen.cols;
    let rows = layout.screen.rows;
    let border_fg = Color::Named(NamedColor::BrightBlack);
    let focus_fg = Color::Named(NamedColor::BrightCyan);

    let divider_fg = |adjacent: &[u8]| {
        if adjacent.contains(&focus_pane) {
            focus_fg
        } else {
            border_fg
        }
    };

    match layout.active_count {
        2 => {
            let div_col = layout.panes[0].cols;
            for row in 0..rows {
                paint_border_cell(cells, cols, div_col, row, '│', divider_fg(&[0, 1]));
            }
        }
        4 => {
            let div_col = layout.panes[0].cols;
            let div_row = layout.panes[0].rows;

            for row in 0..rows {
                if row == div_row {
                    continue;
                }
                let left = if row < div_row { 0 } else { 2 };
                let right = if row < div_row { 1 } else { 3 };
                paint_border_cell(cells, cols, div_col, row, '│', divider_fg(&[left, right]));
            }

            for col in 0..cols {
                if col == div_col {
                    continue;
                }
                let top = if col < div_col { 0 } else { 1 };
                let bottom = if col < div_col { 2 } else { 3 };
                paint_border_cell(cells, cols, col, div_row, '─', divider_fg(&[top, bottom]));
            }

            paint_border_cell(cells, cols, div_col, div_row, '┼', border_fg);
        }
        _ => {}
    }
}

fn paint_border_cell(
    cells: &mut [ComposedCell],
    cols: usize,
    col: usize,
    row: usize,
    ch: char,
    fg: Color,
) {
    let idx = row * cols + col;
    if idx >= cells.len() {
        return;
    }
    cells[idx] = ComposedCell {
        ch,
        fg,
        bg: Color::Named(NamedColor::Background),
        bold: false,
        italic: false,
        inverse: false,
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::layout::GridLayout;
    use crate::pane::PaneTerminal;
    use crate::util::TerminalSize;

    #[test]
    fn four_pane_layout_draws_cross_divider() {
        let layout = GridLayout::compute(120, 40, 4);
        let empty = [
            PaneTerminal::new(&TerminalSize::new(1, 1)),
            PaneTerminal::new(&TerminalSize::new(1, 1)),
            PaneTerminal::new(&TerminalSize::new(1, 1)),
            PaneTerminal::new(&TerminalSize::new(1, 1)),
        ];
        let refs = [&empty[0], &empty[1], &empty[2], &empty[3]];
        let screen = ComposedScreen::compose_from_refs(&layout, &refs, 0);
        let div_col = layout.panes[0].cols;
        let div_row = layout.panes[0].rows;
        assert_eq!(screen.cells[div_row * screen.cols + div_col].ch, '┼');
        assert_eq!(screen.cells[0 * screen.cols + div_col].ch, '│');
        assert_eq!(screen.cells[div_row * screen.cols + 0].ch, '─');
    }
}
