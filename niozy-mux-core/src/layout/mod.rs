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
                let half = screen.cols / 2;
                panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: half.max(1),
                    rows: screen.rows,
                };
                panes[1] = Rect {
                    col: half,
                    row: 0,
                    cols: screen.cols.saturating_sub(half).max(1),
                    rows: screen.rows,
                };
            }
            _ => {
                let half_cols = (screen.cols / 2).max(1);
                let half_rows = (screen.rows / 2).max(1);
                panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: half_cols,
                    rows: half_rows,
                };
                panes[1] = Rect {
                    col: half_cols,
                    row: 0,
                    cols: screen.cols.saturating_sub(half_cols).max(1),
                    rows: half_rows,
                };
                panes[2] = Rect {
                    col: 0,
                    row: half_rows,
                    cols: half_cols,
                    rows: screen.rows.saturating_sub(half_rows).max(1),
                };
                panes[3] = Rect {
                    col: half_cols,
                    row: half_rows,
                    cols: screen.cols.saturating_sub(half_cols).max(1),
                    rows: screen.rows.saturating_sub(half_rows).max(1),
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
        assert_eq!(layout.panes[0].cols, 60);
        assert_eq!(layout.panes[0].rows, 20);
        assert_eq!(layout.panes[3].col, 60);
        assert_eq!(layout.panes[3].row, 20);
    }
}
