use std::io::Read;
// ====================================================================
// PPTX → Markdown (ZIP of XML, similar to DOCX)
// ====================================================================

pub(super) fn convert_pptx(path: &str) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| format!("Can't open file: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Not a valid PPTX: {e}"))?;

    // Collect slide filenames (ppt/slides/slide1.xml, slide2.xml, ...)
    let mut slide_names: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index(i) {
            let name = entry.name().to_string();
            if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
                slide_names.push(name);
            }
        }
    }
    slide_names.sort();

    let mut out = String::new();

    for (idx, slide_name) in slide_names.iter().enumerate() {
        let mut xml = String::new();
        archive
            .by_name(slide_name)
            .map_err(|e| format!("Can't read {slide_name}: {e}"))?
            .read_to_string(&mut xml)
            .map_err(|e| format!("Read error: {e}"))?;

        let texts = extract_pptx_texts(&xml);
        if !texts.is_empty() {
            out.push_str(&format!("## Slide {}\n\n", idx + 1));
            for text in &texts {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    out.push_str(trimmed);
                    out.push_str("\n\n");
                }
            }
        }
    }

    if out.is_empty() {
        return Err("No text content found in PPTX".to_string());
    }

    Ok(out.trim().to_string())
}

/// Extract text runs from a PPTX slide XML. Each <a:p> becomes a separate
/// text block; <a:r><a:t> elements provide the actual text.
fn extract_pptx_texts(xml: &str) -> Vec<String> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    let mut paragraphs: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_text = false;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if name == "t" {
                    in_text = true;
                } else if name == "p" {
                    current.clear();
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_text {
                    if let Ok(text) = e.unescape() {
                        current.push_str(&text);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if name == "t" {
                    in_text = false;
                } else if name == "p" {
                    let trimmed = current.trim().to_string();
                    if !trimmed.is_empty() {
                        paragraphs.push(trimmed);
                    }
                    current.clear();
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    paragraphs
}
