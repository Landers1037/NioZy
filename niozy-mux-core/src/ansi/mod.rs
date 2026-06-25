use crate::compositor::{ComposedCell, ComposedScreen};
use alacritty_terminal::vte::ansi::{Color, NamedColor};

pub fn render_full_redraw(screen: &ComposedScreen) -> Vec<u8> {
    let mut out = Vec::with_capacity(screen.cols * screen.rows * 16);
    out.extend_from_slice(b"\x1b[2J\x1b[H");

    let mut prev_fg: Option<Color> = None;
    let mut prev_bg: Option<Color> = None;
    let mut prev_attrs: u8 = 0;

    for row in 0..screen.rows {
        if row > 0 {
            out.extend_from_slice(b"\r\n");
        }
        for col in 0..screen.cols {
            let cell = &screen.cells[row * screen.cols + col];
            emit_cell_style(&mut out, cell, &mut prev_fg, &mut prev_bg, &mut prev_attrs);
            if cell.ch == '\0' {
                out.push(b' ');
            } else {
                append_char(&mut out, cell.ch);
            }
        }
    }

    out.extend_from_slice(b"\x1b[0m");
    if let Some((col, row)) = screen.cursor {
        out.extend_from_slice(format!("\x1b[{};{}H", row + 1, col + 1).as_bytes());
    }
    out.extend_from_slice(b"\x1b[?25h");
    out
}

fn emit_cell_style(
    out: &mut Vec<u8>,
    cell: &ComposedCell,
    prev_fg: &mut Option<Color>,
    prev_bg: &mut Option<Color>,
    prev_attrs: &mut u8,
) {
    let attrs = attr_bits(cell);
    if *prev_fg != Some(cell.fg) || *prev_bg != Some(cell.bg) || *prev_attrs != attrs {
        out.extend_from_slice(b"\x1b[0");
        write_color(out, cell.fg, true);
        write_color(out, cell.bg, false);
        if cell.bold {
            out.extend_from_slice(b";1");
        }
        if cell.italic {
            out.extend_from_slice(b";3");
        }
        if cell.inverse {
            out.extend_from_slice(b";7");
        }
        out.push(b'm');
        *prev_fg = Some(cell.fg);
        *prev_bg = Some(cell.bg);
        *prev_attrs = attrs;
    }
}

fn attr_bits(cell: &ComposedCell) -> u8 {
    (cell.bold as u8) | ((cell.italic as u8) << 1) | ((cell.inverse as u8) << 2)
}

fn write_color(out: &mut Vec<u8>, color: Color, foreground: bool) {
    match color {
        Color::Named(named) => {
            if let Some(code) = named_color_sgr(named, foreground) {
                out.extend_from_slice(format!(";{code}").as_bytes());
            }
        }
        Color::Indexed(idx) => {
            let base = if foreground { "38;5" } else { "48;5" };
            out.extend_from_slice(format!(";{};{}", base, idx).as_bytes());
        }
        Color::Spec(rgb) => {
            let base = if foreground { "38;2" } else { "48;2" };
            out.extend_from_slice(format!(";{};{};{};{}", base, rgb.r, rgb.g, rgb.b).as_bytes());
        }
    }
}

fn named_color_sgr(named: NamedColor, foreground: bool) -> Option<u8> {
    match named {
        NamedColor::Foreground | NamedColor::BrightForeground | NamedColor::DimForeground => {
            foreground.then_some(39)
        }
        NamedColor::Background => (!foreground).then_some(49),
        NamedColor::Black
        | NamedColor::Red
        | NamedColor::Green
        | NamedColor::Yellow
        | NamedColor::Blue
        | NamedColor::Magenta
        | NamedColor::Cyan
        | NamedColor::White => {
            let offset = named as u8;
            Some(if foreground { 30 + offset } else { 40 + offset })
        }
        NamedColor::BrightBlack
        | NamedColor::BrightRed
        | NamedColor::BrightGreen
        | NamedColor::BrightYellow
        | NamedColor::BrightBlue
        | NamedColor::BrightMagenta
        | NamedColor::BrightCyan
        | NamedColor::BrightWhite => {
            let offset = (named as u8) - (NamedColor::BrightBlack as u8);
            Some(if foreground { 90 + offset } else { 100 + offset })
        }
        _ => None,
    }
}

fn append_char(out: &mut Vec<u8>, ch: char) {
    let mut buf = [0u8; 4];
    out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_redraw_starts_with_clear_and_home() {
        let screen = ComposedScreen {
            cols: 2,
            rows: 1,
            cursor: None,
            cells: vec![
                ComposedCell {
                    ch: 'A',
                    fg: Color::Named(NamedColor::Foreground),
                    bg: Color::Named(NamedColor::Background),
                    bold: false,
                    italic: false,
                    inverse: false,
                },
                ComposedCell {
                    ch: 'B',
                    fg: Color::Named(NamedColor::Foreground),
                    bg: Color::Named(NamedColor::Background),
                    bold: false,
                    italic: false,
                    inverse: false,
                },
            ],
        };
        let bytes = render_full_redraw(&screen);
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.starts_with("\x1b[2J\x1b[H"));
        assert!(text.contains("AB"));
        assert!(!text.contains("286"));
    }

    #[test]
    fn default_named_colors_use_reset_codes() {
        let screen = ComposedScreen {
            cols: 1,
            rows: 1,
            cursor: None,
            cells: vec![ComposedCell {
                ch: 'X',
                fg: Color::Named(NamedColor::Foreground),
                bg: Color::Named(NamedColor::Background),
                bold: false,
                italic: false,
                inverse: false,
            }],
        };
        let bytes = render_full_redraw(&screen);
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains(";39"));
        assert!(text.contains(";49"));
    }
}
