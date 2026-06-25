use crate::util::TerminalSize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub col: usize,
    pub row: usize,
    pub cols: usize,
    pub rows: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutKind {
    Single,
    /// 2×1 horizontal split (left / right)
    Horizontal2,
    /// 1×2 vertical split (top / bottom)
    Vertical2,
    /// 2×2 grid (four panes)
    Grid4,
    /// 2 on top + 1 full-width bottom (after closing one pane from grid)
    Grid3,
}

impl LayoutKind {
    pub fn active_count(self) -> u8 {
        match self {
            Self::Single => 1,
            Self::Horizontal2 | Self::Vertical2 => 2,
            Self::Grid3 => 3,
            Self::Grid4 => 4,
        }
    }

    pub fn from_kind_str(kind: &str, pane_count: u8) -> Self {
        match kind {
            "1" => Self::Single,
            "2x1" => Self::Horizontal2,
            "1x2" => Self::Vertical2,
            "2x2" => Self::Grid4,
            _ => match pane_count.clamp(1, 4) {
                1 => Self::Single,
                2 => Self::Horizontal2,
                _ => Self::Grid4,
            },
        }
    }

    pub fn kind_str(self) -> &'static str {
        match self {
            Self::Single => "1",
            Self::Horizontal2 => "2x1",
            Self::Vertical2 => "1x2",
            Self::Grid4 => "2x2",
            Self::Grid3 => "grid3",
        }
    }

    pub fn layout_after_close(self, remaining: u8) -> Self {
        match remaining {
            0 | 1 => Self::Single,
            2 => match self {
                Self::Vertical2 => Self::Vertical2,
                _ => Self::Horizontal2,
            },
            3 => Self::Grid3,
            _ => Self::Grid4,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdjustDirection {
    Left,
    Right,
    Up,
    Down,
}

#[derive(Debug, Clone)]
pub struct GridLayout {
    pub screen: TerminalSize,
    pub panes: [Rect; 4],
    pub kind: LayoutKind,
    /// Column index of the vertical divider (left pane width)
    pub split_col: usize,
    /// Row index of the horizontal divider (top pane height)
    pub split_row: usize,
}

impl GridLayout {
    pub fn compute(screen_cols: u16, screen_rows: u16, kind: LayoutKind) -> Self {
        let screen = TerminalSize::new(screen_cols, screen_rows);
        let inner_cols = screen.cols.saturating_sub(1).max(2);
        let inner_rows = screen.rows.saturating_sub(1).max(2);
        let split_col = (inner_cols / 2).max(1);
        let split_row = (inner_rows / 2).max(1);

        let mut layout = Self {
            screen,
            panes: [Rect {
                col: 0,
                row: 0,
                cols: 0,
                rows: 0,
            }; 4],
            kind,
            split_col,
            split_row,
        };
        layout.recompute_pane_rects();
        layout
    }

    pub fn active_count(&self) -> u8 {
        self.kind.active_count()
    }

    pub fn pane_size(&self, index: u8) -> TerminalSize {
        let rect = self.panes[index as usize];
        TerminalSize::new(rect.cols as u16, rect.rows as u16)
    }

    pub fn adjust_split(&mut self, direction: AdjustDirection, focus_pane: u8) {
        if focus_pane >= self.active_count() {
            return;
        }

        let inner_cols = self.screen.cols.saturating_sub(1).max(2);
        let inner_rows = self.screen.rows.saturating_sub(1).max(2);
        let min_pane = 1usize;

        match self.kind {
            LayoutKind::Horizontal2 => match direction {
                AdjustDirection::Left => {
                    self.split_col = self.split_col.saturating_sub(1).max(min_pane);
                }
                AdjustDirection::Right => {
                    self.split_col = (self.split_col + 1).min(inner_cols - min_pane);
                }
                _ => return,
            },
            LayoutKind::Vertical2 => match direction {
                AdjustDirection::Up => {
                    self.split_row = self.split_row.saturating_sub(1).max(min_pane);
                }
                AdjustDirection::Down => {
                    self.split_row = (self.split_row + 1).min(inner_rows - min_pane);
                }
                _ => return,
            },
            LayoutKind::Grid4 => match direction {
                AdjustDirection::Left => {
                    self.split_col = self.split_col.saturating_sub(1).max(min_pane);
                }
                AdjustDirection::Right => {
                    self.split_col = (self.split_col + 1).min(inner_cols - min_pane);
                }
                AdjustDirection::Up => {
                    self.split_row = self.split_row.saturating_sub(1).max(min_pane);
                }
                AdjustDirection::Down => {
                    self.split_row = (self.split_row + 1).min(inner_rows - min_pane);
                }
            },
            LayoutKind::Grid3 => match direction {
                AdjustDirection::Left => {
                    self.split_col = self.split_col.saturating_sub(1).max(min_pane);
                }
                AdjustDirection::Right => {
                    self.split_col = (self.split_col + 1).min(inner_cols - min_pane);
                }
                AdjustDirection::Up => {
                    self.split_row = self.split_row.saturating_sub(1).max(min_pane);
                }
                AdjustDirection::Down => {
                    self.split_row = (self.split_row + 1).min(inner_rows - min_pane);
                }
            },
            LayoutKind::Single => return,
        }

        self.recompute_pane_rects();
    }

    pub fn set_splits(&mut self, split_col: usize, split_row: usize) {
        self.split_col = split_col;
        self.split_row = split_row;
        self.recompute_pane_rects();
    }

    fn recompute_pane_rects(&mut self) {
        let cols = self.screen.cols;
        let rows = self.screen.rows;
        let inner_cols = cols.saturating_sub(1).max(2);
        let inner_rows = rows.saturating_sub(1).max(2);
        let left = self.split_col.max(1).min(inner_cols - 1);
        let right = inner_cols.saturating_sub(left).max(1);
        let top = self.split_row.max(1).min(inner_rows - 1);
        let bottom = inner_rows.saturating_sub(top).max(1);
        self.split_col = left;
        self.split_row = top;

        match self.kind {
            LayoutKind::Single => {
                self.panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols,
                    rows,
                };
            }
            LayoutKind::Horizontal2 => {
                self.panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: left,
                    rows,
                };
                self.panes[1] = Rect {
                    col: left + 1,
                    row: 0,
                    cols: right,
                    rows,
                };
            }
            LayoutKind::Vertical2 => {
                self.panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols,
                    rows: top,
                };
                self.panes[1] = Rect {
                    col: 0,
                    row: top + 1,
                    cols,
                    rows: bottom,
                };
            }
            LayoutKind::Grid4 => {
                self.panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: left,
                    rows: top,
                };
                self.panes[1] = Rect {
                    col: left + 1,
                    row: 0,
                    cols: right,
                    rows: top,
                };
                self.panes[2] = Rect {
                    col: 0,
                    row: top + 1,
                    cols: left,
                    rows: bottom,
                };
                self.panes[3] = Rect {
                    col: left + 1,
                    row: top + 1,
                    cols: right,
                    rows: bottom,
                };
            }
            LayoutKind::Grid3 => {
                self.panes[0] = Rect {
                    col: 0,
                    row: 0,
                    cols: left,
                    rows: top,
                };
                self.panes[1] = Rect {
                    col: left + 1,
                    row: 0,
                    cols: right,
                    rows: top,
                };
                self.panes[2] = Rect {
                    col: 0,
                    row: top + 1,
                    cols,
                    rows: bottom,
                };
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_pane_layout_splits_screen() {
        let layout = GridLayout::compute(120, 40, LayoutKind::Grid4);
        assert_eq!(layout.panes[0].cols, 59);
        assert_eq!(layout.panes[0].rows, 19);
        assert_eq!(layout.panes[3].col, 60);
        assert_eq!(layout.panes[3].row, 20);
    }

    #[test]
    fn vertical_two_pane_layout() {
        let layout = GridLayout::compute(80, 24, LayoutKind::Vertical2);
        assert_eq!(layout.panes[0].rows, 11);
        assert_eq!(layout.panes[1].row, 12);
        assert_eq!(layout.panes[0].cols, 80);
    }

    #[test]
    fn horizontal_split_right_pane_left_arrow_widens_right() {
        let mut layout = GridLayout::compute(80, 24, LayoutKind::Horizontal2);
        let initial_right = layout.panes[1].cols;
        layout.adjust_split(AdjustDirection::Left, 1);
        assert!(layout.panes[1].cols > initial_right);
    }

    #[test]
    fn horizontal_split_left_pane_right_arrow_widens_left() {
        let mut layout = GridLayout::compute(80, 24, LayoutKind::Horizontal2);
        let initial_left = layout.panes[0].cols;
        layout.adjust_split(AdjustDirection::Right, 0);
        assert!(layout.panes[0].cols > initial_left);
    }
}
