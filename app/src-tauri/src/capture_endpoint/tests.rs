use super::*;

#[test]
fn slug_basic() {
    assert_eq!(slugify("Hello, World!"), "hello-world");
    assert_eq!(slugify("  multi   spaces  "), "multi-spaces");
    assert_eq!(slugify("---"), "");
}

#[test]
fn slug_keeps_cjk() {
    // CJK chars are preserved (readable on every shipping platform).
    let got = slugify("你好 世界");
    assert!(got.contains('你'));
    assert!(got.contains('世'));
}

#[test]
fn token_is_32_hex() {
    let t = random_token();
    assert_eq!(t.len(), 32);
    assert!(t.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn first_h1_extraction() {
    assert_eq!(
        extract_first_h1("preamble\n\n# The Title\n\nbody"),
        Some("The Title".to_string()),
    );
    assert_eq!(extract_first_h1("no headings here"), None);
}

#[test]
fn yaml_scalar_quotes_when_needed() {
    assert_eq!(yaml_scalar("plain"), "plain");
    assert_eq!(yaml_scalar("has: colon"), "\"has: colon\"");
    assert_eq!(yaml_scalar("with \"quote\""), "\"with \\\"quote\\\"\"");
    // URLs and `time:value` style strings are NOT force-quoted because
    // the colon isn't followed by a space — that's what the YAML spec
    // distinguishes.
    assert_eq!(yaml_scalar("https://example.com"), "https://example.com");
    assert_eq!(yaml_scalar("12:34"), "12:34");
}

#[test]
fn front_matter_is_stripped_when_present() {
    let stripped = strip_front_matter("---\nfoo: 1\n---\nbody\n");
    assert_eq!(stripped, "body\n");
    let untouched = strip_front_matter("no front matter here");
    assert_eq!(untouched, "no front matter here");
}

#[test]
fn render_note_emits_required_fields() {
    let body = render_note(
        "T",
        "hello",
        Some("https://x"),
        Some(&["a".to_string(), "b".to_string()]),
        true,
        "2026-04-26T11:30:00+08:00",
    );
    assert!(body.starts_with("---\n"));
    assert!(body.contains("title: T\n"));
    assert!(body.contains("source: https://x\n"));
    assert!(body.contains("tags: [a, b]\n"));
    assert!(body.contains("inbox: true\n"));
    assert!(body.contains("captured_at: 2026-04-26T11:30:00+08:00\n"));
    assert!(body.ends_with("hello\n"));
}
