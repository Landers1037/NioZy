use crate::util::TerminalSize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub col: usize,
    pub row: usize,
    pub cols: usize,
    pub rows: usize,
}

#[derive(Debug, Clone)]
pub struct GridLayout {
    pub screen: TerminalSize,
    pub panes: [Rect; 4],
    pub active_count: u8,
}

impl GridLayout {
    pub fn compute(screen_cols: u16, screen_rows: u16, pane_count: u8) -> Self {
        let screen = TerminalSize::new(screen_cols, screen_rows);
        let count = pane_count.clamp(1, 4);
        let mut panes = [Rect {
            col: 0,
            row: 0,
            cols: 0,
            rows: 0,
        }; 4];

        match count {
            1 => {
                panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: screen.cols,
                    rows: screen.rows,
                };
            }
            2 => {
                let inner_cols = screen.cols.saturating_sub(1).max(2);
                let left = (inner_cols / 2).max(1);
                let right = inner_cols.saturating_sub(left).max(1);
                panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: left,
                    rows: screen.rows,
                };
                panes[1] = Rect {
                    col: left + 1,
                    row: 0,
                    cols: right,
                    rows: screen.rows,
                };
            }
            _ => {
                let inner_cols = screen.cols.saturating_sub(1).max(2);
                let inner_rows = screen.rows.saturating_sub(1).max(2);
                let left = (inner_cols / 2).max(1);
                let right = inner_cols.saturating_sub(left).max(1);
                let top = (inner_rows / 2).max(1);
                let bottom = inner_rows.saturating_sub(top).max(1);
                panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: left,
                    rows: top,
                };
                panes[1] = Rect {
                    col: left + 1,
                    row: 0,
                    cols: right,
                    rows: top,
                };
                panes[2] = Rect {
                    col: 0,
                    row: top + 1,
                    cols: left,
                    rows: bottom,
                };
                panes[3] = Rect {
                    col: left + 1,
                    row: top + 1,
                    cols: right,
                    rows: bottom,
                };
            }
        }

        Self {
            screen,
            panes,
            active_count: count,
        }
    }

    pub fn pane_size(&self, index: u8) -> TerminalSize {
        let rect = self.panes[index as usize];
        TerminalSize::new(rect.cols as u16, rect.rows as u16)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_pane_layout_splits_screen() {
        let layout = GridLayout::compute(120, 40, 4);
        assert_eq!(layout.panes[0].cols, 59);
        assert_eq!(layout.panes[0].rows, 19);
        assert_eq!(layout.panes[3].col, 60);
        assert_eq!(layout.panes[3].row, 20);
    }
}
