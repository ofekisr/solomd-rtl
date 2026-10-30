use super::*;
use std::io::Write;

fn write_tmp(name: &str, body: &[u8]) -> std::path::PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("solomd-svg-guard-{}-{name}", std::process::id()));
    let mut f = std::fs::File::create(&p).unwrap();
    f.write_all(body).unwrap();
    p
}

#[test]
fn rejects_the_issue_304_poc() {
    let p = write_tmp("poc.svg", br#"<svg xmlns="http://www.w3.org/2000/svg" onload="alert(2)"><rect/></svg>"#);
    let err = reject_active_svg(p.to_str().unwrap()).unwrap_err();
    assert!(err.contains("active content"), "{err}");
    let _ = std::fs::remove_file(p);
}

#[test]
fn rejects_script_inside_svg() {
    let p = write_tmp("s.svg", b"<svg><script>fetch('//evil')</script></svg>");
    assert!(reject_active_svg(p.to_str().unwrap()).is_err());
    let _ = std::fs::remove_file(p);
}

#[test]
fn rejects_svg_bytes_hiding_behind_a_png_extension() {
    let p = write_tmp("sneaky.png", b"<?xml version=\"1.0\"?>\n<svg onload=\"x()\"></svg>");
    assert!(reject_active_svg(p.to_str().unwrap()).is_err());
    let _ = std::fs::remove_file(p);
}

#[test]
fn allows_static_svg() {
    let p = write_tmp("ok.svg", br##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L10 10" stroke="#333"/><text font-size="2">on the line</text></svg>"##);
    assert!(reject_active_svg(p.to_str().unwrap()).is_ok());
    let _ = std::fs::remove_file(p);
}

#[test]
fn allows_plain_animation_but_not_href_retargeting() {
    let ok = write_tmp("anim.svg", br#"<svg><rect><animate attributeName="opacity" to="0"/></rect></svg>"#);
    assert!(reject_active_svg(ok.to_str().unwrap()).is_ok());
    let _ = std::fs::remove_file(ok);

    let bad = write_tmp("anim2.svg", br#"<svg><a><animate attributeName="xlink:href" to="data:x"/></a></svg>"#);
    assert!(reject_active_svg(bad.to_str().unwrap()).is_err());
    let _ = std::fs::remove_file(bad);
}

#[test]
fn leaves_real_images_alone() {
    // A PNG header: not SVG, never inspected further.
    let p = write_tmp("a.png", &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    assert!(reject_active_svg(p.to_str().unwrap()).is_ok());
    let _ = std::fs::remove_file(p);
}

#[test]
fn refuses_compressed_svg() {
    assert!(reject_active_svg("/nope/whatever.svgz").is_err());
}
