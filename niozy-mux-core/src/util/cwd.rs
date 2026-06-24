/// Extract OSC 7 working directory sequences from PTY output.
pub fn extract_cwd_from_bytes(bytes: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(bytes);
    for segment in text.split('\x1b') {
        if let Some(path) = parse_osc7(segment) {
            return Some(path);
        }
    }
    None
}

fn parse_osc7(segment: &str) -> Option<String> {
    let payload = segment.strip_prefix("]7;")?;
    let end = payload.find('\x07').or_else(|| payload.find("\x1b\\"))?;
    let payload = payload[..end].trim();
    decode_osc7_path(payload)
}

fn decode_osc7_path(payload: &str) -> Option<String> {
    if payload.is_empty() {
        return None;
    }

    let path = if let Some(rest) = payload.strip_prefix("file://") {
        let slash = rest.find('/')?;
        let mut path = rest[slash..].to_string();
        if path.starts_with('/') && path.as_bytes().get(2) == Some(&b':') {
            path.remove(0);
        }
        path
    } else if let Some((_kind, path)) = payload.split_once(';') {
        path.to_string()
    } else {
        payload.to_string()
    };

    if path.is_empty() {
        None
    } else {
        Some(path.replace('/', "\\"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_osc7_bell_terminated() {
        let bytes = b"\x1b]7;file://host/C:/Users/test\x07";
        assert_eq!(
            extract_cwd_from_bytes(bytes),
            Some("C:\\Users\\test".to_string())
        );
    }
}
