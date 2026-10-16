//! Byte ranges of Markdown code, per line: every line of a fenced block
//! (fence lines included) and every inline code span. Find & replace uses it
//! to leave code alone when `skip_code` is set. Line-based like the rest of
//! search, so a code span never crosses a line here.

pub type ByteRange = (usize, usize);

const MIN_FENCE: usize = 3;
const MAX_FENCE_INDENT: usize = 3;

struct Fence {
    marker: char,
    len: usize,
}

/// One entry per line of `text`, split the same way `str::lines` does.
pub fn code_ranges_by_line(text: &str) -> Vec<Vec<ByteRange>> {
    let mut open: Option<Fence> = None;
    text.lines()
        .map(|line| {
            let fence = fence_run(line);
            if let Some(current) = &open {
                if let Some((marker, len, rest)) = fence {
                    if marker == current.marker && len >= current.len && rest.trim().is_empty() {
                        open = None;
                    }
                }
                return vec![(0, line.len())];
            }
            let inline = inline_code_spans(line);
            if inline.first() == Some(&(0, line.len())) || inline.is_empty() {
                if let Some((marker, len, rest)) = fence {
                    let is_opener = !(marker == '`' && rest.contains('`'));
                    if is_opener {
                        open = Some(Fence { marker, len });
                        return vec![(0, line.len())];
                    }
                }
            }
            inline
        })
        .collect()
}

fn fence_run(line: &str) -> Option<(char, usize, &str)> {
    let trimmed = line.trim_start_matches(' ');
    if line.len() - trimmed.len() > MAX_FENCE_INDENT {
        return None;
    }
    let marker = trimmed.chars().next().filter(|c| *c == '`' || *c == '~')?;
    let len = trimmed.chars().take_while(|c| *c == marker).count();
    (len >= MIN_FENCE).then(|| (marker, len, &trimmed[len..]))
}

/// Backtick runs pair with the next run of the same length; an unmatched run
/// is literal text.
pub fn inline_code_spans(line: &str) -> Vec<ByteRange> {
    let runs = backtick_runs(line);
    let mut spans = Vec::new();
    let mut i = 0;
    while i < runs.len() {
        let (start, len) = runs[i];
        match runs[i + 1..].iter().position(|&(_, l)| l == len) {
            Some(offset) => {
                let (close_start, close_len) = runs[i + 1 + offset];
                spans.push((start, close_start + close_len));
                i += offset + 2;
            }
            None => i += 1,
        }
    }
    spans
}

fn backtick_runs(line: &str) -> Vec<(usize, usize)> {
    let bytes = line.as_bytes();
    let mut runs = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'`' {
            i += 1;
            continue;
        }
        let start = i;
        while i < bytes.len() && bytes[i] == b'`' {
            i += 1;
        }
        runs.push((start, i - start));
    }
    runs
}

pub fn overlaps(ranges: &[ByteRange], start: usize, end: usize) -> bool {
    ranges.iter().any(|&(s, e)| start < e && end.max(start + 1) > s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inline_spans_pair_equal_runs() {
        assert_eq!(inline_code_spans("a `b` c ``d ` e`` f"), vec![(2, 5), (8, 17)]);
        assert_eq!(inline_code_spans("lone ` tick"), vec![]);
    }

    #[test]
    fn fenced_block_lines_are_code() {
        let text = "x\n```js\nlet a\n```\ny `z`";
        let r = code_ranges_by_line(text);
        assert_eq!(r[0], vec![]);
        assert_eq!(r[1], vec![(0, 5)]);
        assert_eq!(r[2], vec![(0, 5)]);
        assert_eq!(r[3], vec![(0, 3)]);
        assert_eq!(r[4], vec![(2, 5)]);
    }

    #[test]
    fn single_line_fence_is_code_and_does_not_open_a_block() {
        let r = code_ranges_by_line("```py; x```\nafter");
        assert_eq!(r[0], vec![(0, 11)]);
        assert_eq!(r[1], vec![]);
    }

    #[test]
    fn tilde_fence_needs_matching_closer() {
        let r = code_ranges_by_line("~~~~\n```\n~~~~\nout");
        assert_eq!(r[1], vec![(0, 3)]);
        assert_eq!(r[3], vec![]);
    }
}
