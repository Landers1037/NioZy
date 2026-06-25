use alacritty_terminal::term::cell::Cell;
use alacritty_terminal::term::{point_to_viewport, TermMode};
use alacritty_terminal::vte::ansi::{Color, NamedColor};
use crate::layout::{GridLayout, LayoutKind};
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
    /// Global screen cursor (col, row), 0-based. Drives xterm DEC cursor after full redraw.
    pub cursor: Option<(usize, usize)>,
}

impl ComposedScreen {
    pub fn compose_from_refs(
        layout: &GridLayout,
        panes: &[&PaneTerminal; 4],
        focus_pane: u8,
        resize_mode: bool,
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

        for pane_index in 0..layout.active_count() {
            let rect = layout.panes[pane_index as usize];
            let pane = panes[pane_index as usize];
            let content = pane.term.renderable_content();
            let display_offset = content.display_offset;
            for indexed in content.display_iter {
                let Some(viewport_point) = point_to_viewport(display_offset, indexed.point) else {
                    continue;
                };
                let local_row = viewport_point.line;
                let local_col = viewport_point.column.0;
                if local_row >= rect.rows || local_col >= rect.cols {
                    continue;
                }
                let global_col = rect.col + local_col;
                let global_row = rect.row + local_row;
                if global_col >= cols || global_row >= rows {
                    continue;
                }
                cells[global_row * cols + global_col] = composed_from_cell(&indexed.cell);
            }
        }

        draw_pane_borders(&mut cells, layout, focus_pane);
        if resize_mode && layout.active_count() > 1 && focus_pane < layout.active_count() {
            draw_pane_resize_highlight(&mut cells, layout, focus_pane);
        }
        let cursor = focus_cursor_position(layout, panes, focus_pane);

        Self {
            cols,
            rows,
            cells,
            cursor,
        }
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
    if layout.active_count() <= 1 {
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

    match layout.kind {
        LayoutKind::Horizontal2 => {
            let div_col = layout.panes[0].cols;
            for row in 0..rows {
                paint_border_cell(cells, cols, div_col, row, '│', divider_fg(&[0, 1]), false);
            }
        }
        LayoutKind::Vertical2 => {
            let div_row = layout.panes[0].rows;
            for col in 0..cols {
                paint_border_cell(cells, cols, col, div_row, '─', divider_fg(&[0, 1]), false);
            }
        }
        LayoutKind::Grid4 => {
            let div_col = layout.panes[0].cols;
            let div_row = layout.panes[0].rows;

            for row in 0..rows {
                if row == div_row {
                    continue;
                }
                let left = if row < div_row { 0 } else { 2 };
                let right = if row < div_row { 1 } else { 3 };
                paint_border_cell(cells, cols, div_col, row, '│', divider_fg(&[left, right]), false);
            }

            for col in 0..cols {
                if col == div_col {
                    continue;
                }
                let top = if col < div_col { 0 } else { 1 };
                let bottom = if col < div_col { 2 } else { 3 };
                paint_border_cell(cells, cols, col, div_row, '─', divider_fg(&[top, bottom]), false);
            }

            paint_border_cell(cells, cols, div_col, div_row, '┼', border_fg, false);
        }
        LayoutKind::Grid3 => {
            let div_col = layout.panes[0].cols;
            let div_row = layout.panes[0].rows;

            for row in 0..div_row {
                paint_border_cell(cells, cols, div_col, row, '│', divider_fg(&[0, 1]), false);
            }
            paint_border_cell(cells, cols, div_col, div_row, '┬', border_fg, false);

            for col in 0..cols {
                if col == div_col {
                    continue;
                }
                let top = if col < div_col { 0 } else { 1 };
                paint_border_cell(cells, cols, col, div_row, '─', divider_fg(&[top, 2]), false);
            }
            paint_border_cell(cells, cols, div_col, div_row, '┴', border_fg, false);
        }
        LayoutKind::Single => {}
    }
}

fn draw_pane_resize_highlight(cells: &mut [ComposedCell], layout: &GridLayout, focus_pane: u8) {
    let rect = layout.panes[focus_pane as usize];
    let cols = layout.screen.cols;
    let highlight_fg = Color::Named(NamedColor::BrightMagenta);

    if rect.rows == 0 || rect.cols == 0 {
        return;
    }

    let left = rect.col;
    let right = rect.col + rect.cols - 1;
    let top = rect.row;
    let bottom = rect.row + rect.rows - 1;

    for col in left..=right {
        paint_border_cell(cells, cols, col, top, '═', highlight_fg, true);
        paint_border_cell(cells, cols, col, bottom, '═', highlight_fg, true);
    }
    for row in top..=bottom {
        paint_border_cell(cells, cols, left, row, '║', highlight_fg, true);
        paint_border_cell(cells, cols, right, row, '║', highlight_fg, true);
    }
}

fn focus_cursor_position(
    layout: &GridLayout,
    panes: &[&PaneTerminal; 4],
    focus_pane: u8,
) -> Option<(usize, usize)> {
    if focus_pane >= layout.active_count() {
        return None;
    }

    let pane = panes[focus_pane as usize];
    if !pane.term.mode().contains(TermMode::SHOW_CURSOR) {
        return None;
    }

    let grid = pane.term.grid();
    let viewport_point = point_to_viewport(grid.display_offset(), grid.cursor.point)?;
    let rect = layout.panes[focus_pane as usize];
    if viewport_point.line >= rect.rows || viewport_point.column.0 >= rect.cols {
        return None;
    }

    Some((
        rect.col + viewport_point.column.0,
        rect.row + viewport_point.line,
    ))
}

fn paint_border_cell(
    cells: &mut [ComposedCell],
    cols: usize,
    col: usize,
    row: usize,
    ch: char,
    fg: Color,
    bold: bool,
) {
    let idx = row * cols + col;
    if idx >= cells.len() {
        return;
    }
    cells[idx] = ComposedCell {
        ch,
        fg,
        bg: Color::Named(NamedColor::Background),
        bold,
        italic: false,
        inverse: false,
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::layout::{GridLayout, LayoutKind};
    use crate::pane::PaneTerminal;
    use crate::util::TerminalSize;

    #[test]
    fn four_pane_layout_draws_cross_divider() {
        let layout = GridLayout::compute(120, 40, LayoutKind::Grid4);
        let empty = [
            PaneTerminal::new(&TerminalSize::new(1, 1)),
            PaneTerminal::new(&TerminalSize::new(1, 1)),
            PaneTerminal::new(&TerminalSize::new(1, 1)),
            PaneTerminal::new(&TerminalSize::new(1, 1)),
        ];
        let refs = [&empty[0], &empty[1], &empty[2], &empty[3]];
        let screen = ComposedScreen::compose_from_refs(&layout, &refs, 0, false);
        let div_col = layout.panes[0].cols;
        let div_row = layout.panes[0].rows;
        assert_eq!(screen.cells[div_row * screen.cols + div_col].ch, '┼');
        assert_eq!(screen.cells[0 * screen.cols + div_col].ch, '│');
        assert_eq!(screen.cells[div_row * screen.cols + 0].ch, '─');
    }

    #[test]
    fn compose_clips_cells_outside_pane_rect() {
        let layout = GridLayout::compute(80, 24, LayoutKind::Horizontal2);
        let left_rect = layout.panes[0];
        let right_start = layout.panes[1].col;
        let mut left = PaneTerminal::new(&TerminalSize::new(80, 24));
        left.write_bytes(b"X".repeat(80).as_slice());
        let mut right = PaneTerminal::new(&TerminalSize::new(layout.panes[1].cols as u16, 24));
        right.write_bytes(b"Y");
        let refs = [
            &left,
            &right,
            &PaneTerminal::new(&TerminalSize::new(1, 1)),
            &PaneTerminal::new(&TerminalSize::new(1, 1)),
        ];
        let screen = ComposedScreen::compose_from_refs(&layout, &refs, 0, false);
        assert_eq!(screen.cells[right_start].ch, 'Y');
        assert_eq!(screen.cells[left_rect.cols - 1].ch, 'X');
        assert_eq!(screen.cells[left_rect.cols].ch, '│');
    }
}
