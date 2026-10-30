// ---------------------------------------------------------------------------
// SVG upload guard (#304)
// ---------------------------------------------------------------------------

use std::path::Path;

/// Markers of *active* content inside an SVG document. All lowercase; the
/// haystack is lowercased before matching.
const SVG_ACTIVE_MARKERS: &[&str] = &[
    "<script",
    "<foreignobject",
    "<iframe",
    "<embed",
    "<object",
    "<handler",
    "javascript:",
    "vbscript:",
    "data:text/html",
];

/// Refuse to upload an SVG that carries script, event handlers or embedded
/// documents.
///
/// WHY: an image bed is a *stored-XSS delivery service* when it happily serves
/// `image/svg+xml`. An SVG is not a picture — it is an XML document, and when a
/// browser navigates to it (not `<img src>`, but the plain URL the image bed
/// hands back, which is exactly what users click and paste) it renders as a
/// document: `<script>` runs, `onload=` fires, `javascript:` links work, all in
/// the origin of the image host. That origin is shared with every other note,
/// user and site on the same bucket/CDN — reading its cookies, its localStorage
/// and its same-origin pages. sm.ms / GitHub raw / S3+CDN all replay whatever
/// bytes and Content-Type they were given, so a poisoned SVG uploaded from this
/// editor becomes a permanent, linkable XSS payload hosted under the user's own
/// account. This is exactly the case reported in issue #304 (`poc.svg` with
/// `<svg onload=alert(2)>` came back as `200 image/svg+xml`).
///
/// We reject rather than rewrite on purpose: silently mutating a user's vector
/// artwork (stripping the animation they meant to keep) is worse than telling
/// them the file is unsafe and letting them decide. Static SVG — paths, shapes,
/// gradients, text — uploads untouched.
pub(super) fn reject_active_svg(path: &str) -> Result<(), String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    // `.svgz` is a gzipped SVG. We can't inspect it without decompressing, and
    // an image bed will still serve it as image/svg+xml, so it never passes.
    if ext == "svgz" {
        return Err(
            "Refusing to upload a compressed SVG (.svgz): its contents can't be \
             inspected for scripts. Export a plain .svg (or a PNG) instead."
                .to_string(),
        );
    }

    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        // Not readable here? Let the backend produce the real IO error.
        Err(_) => return Ok(()),
    };

    // Sniff rather than trust the extension: `poc.png` whose bytes are an SVG
    // document is still served as SVG by hosts that content-sniff.
    if !(ext == "svg" || looks_like_svg(&bytes)) {
        return Ok(());
    }

    let text = String::from_utf8_lossy(&bytes).to_ascii_lowercase();
    let mut hit: Option<&str> = SVG_ACTIVE_MARKERS
        .iter()
        .find(|m| text.contains(**m))
        .copied();
    if hit.is_none() && has_event_handler_attr(&text) {
        hit = Some("on… event handler");
    }
    // `<animate attributeName="href" to="javascript:…">` / the same trick with
    // `<set>`: animation that rewrites a link target. Plain animated artwork
    // (animating `opacity`, `transform`, …) is fine and stays uploadable.
    if hit.is_none() && animates_href(&text) {
        hit = Some("<animate>/<set> retargeting href");
    }

    match hit {
        None => Ok(()),
        Some(marker) => Err(format!(
            "Refusing to upload this SVG: it contains active content ({marker}). \
             An image host serves .svg as a real document, so scripts inside it \
             would run on the host's origin for anyone who opens the link. \
             Remove the script/event handlers, or upload a PNG/JPEG instead."
        )),
    }
}

/// Does this byte slice look like an SVG document? Skips a UTF-8 BOM and
/// leading whitespace (so an XML declaration / doctype / comment prologue is
/// fine), then looks for `<svg` anywhere in the first few KB.
fn looks_like_svg(bytes: &[u8]) -> bool {
    let head_len = bytes.len().min(4096);
    let head = String::from_utf8_lossy(&bytes[..head_len]).to_ascii_lowercase();
    let trimmed = head.trim_start_matches('\u{feff}').trim_start();
    (trimmed.starts_with('<') || trimmed.starts_with("<?xml")) && head.contains("<svg")
}

/// An `<animate>` / `<set>` element whose `attributeName` is a link target.
/// Input is already lowercased.
fn animates_href(lower: &str) -> bool {
    if !(lower.contains("<animate") || lower.contains("<set")) {
        return false;
    }
    let Some(pos) = lower.find("attributename") else {
        return false;
    };
    let value = &lower[pos + "attributename".len()..];
    let value = value.trim_start().trim_start_matches('=').trim_start();
    let value = value.trim_start_matches(['"', '\'']);
    value.starts_with("href") || value.starts_with("xlink:href")
}

/// `on<event>=` attribute anywhere in the (already lowercased) document. Kept
/// as a hand-rolled scan so we don't take an XML-parser dependency just to say
/// "no" — and so a malformed document that a parser would reject, but a browser
/// would still render, can't sneak through.
fn has_event_handler_attr(lower: &str) -> bool {
    let b = lower.as_bytes();
    let mut i = 0;
    while i + 3 < b.len() {
        if b[i] == b'o' && b[i + 1] == b'n' {
            // Must start an attribute name: preceded by whitespace, `/` or `"`.
            let ok_prefix = i == 0 || matches!(b[i - 1], b' ' | b'\t' | b'\r' | b'\n' | b'/' | b'"' | b'\'');
            if ok_prefix {
                let mut j = i + 2;
                while j < b.len() && (b[j].is_ascii_alphanumeric() || b[j] == b'-') {
                    j += 1;
                }
                // At least one name char, then optional spaces, then `=`.
                if j > i + 2 {
                    let mut k = j;
                    while k < b.len() && matches!(b[k], b' ' | b'\t' | b'\r' | b'\n') {
                        k += 1;
                    }
                    if k < b.len() && b[k] == b'=' {
                        return true;
                    }
                }
            }
        }
        i += 1;
    }
    false
}
