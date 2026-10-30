    use super::commands::workspace_index_referenced_by;
use super::*;

    #[test]
    fn test_strip_inline_code_basic() {
        let stripped = strip_inline_code("purple bg `#1A1033` + text `#9B7EE0`");
        assert!(!stripped.contains('#'), "inline code should be stripped: {:?}", stripped);
    }

    #[test]
    fn test_body_tags_skip_inline_code() {
        let body = "- Active item: purple bg `#1A1033` + text `#9B7EE0` + fontWeight 600\n- Inactive: no fill + text `#94A3B8`\n- Sub-item: padding `[8,12,8,40]`, fontSize 13\n\n#real-tag";
        let tags = extract_body_tags(body);
        assert!(tags.contains(&"real-tag".to_string()), "should find #real-tag");
        assert!(!tags.iter().any(|t| t.contains("9B7EE0")), "should NOT pick up hex color from inline code");
        assert!(!tags.iter().any(|t| t.contains("1A1033")), "should NOT pick up hex color from inline code");
        assert!(!tags.iter().any(|t| t.contains("94A3B8")), "should NOT pick up hex color from inline code");
    }

    #[test]
    fn test_table_backtick_hex_colors() {
        // Exact user-reported lines with backtick-enclosed hex colors in table cells
        let lines = [
            "| `#ffffff` | `#111B27` | Card bg |",
            "| `#f1f5f9` | `#1E293B` | Gray bg / status |",
            "| `#e2e8f0` | `#1E293B` | Dividers |",
        ];
        for line in &lines {
            let stripped = strip_inline_code(line);
            // After stripping inline code, no `#` should remain
            assert!(
                !stripped.contains('#'),
                "strip_inline_code should remove # from backtick content in: {:?} → {:?}",
                line, stripped
            );
        }
        // Full extraction should find zero tags
        let body = lines.join("\n");
        let tags = extract_body_tags(&body);
        assert!(
            tags.is_empty(),
            "backtick-enclosed hex colors should NOT be tags, found: {:?}",
            tags
        );
    }

    #[test]
    fn test_table_no_backtick_hex_colors() {
        // Same content WITHOUT backticks — hex filter should catch them
        let lines = [
            "| #ffffff | #111B27 | Card bg |",
            "| #f1f5f9 | #1E293B | Gray bg / status |",
            "| #e2e8f0 | #1E293B | Dividers |",
        ];
        let body = lines.join("\n");
        let tags = extract_body_tags(&body);
        assert!(
            tags.is_empty(),
            "hex colors without backticks should be filtered by hex check, found: {:?}",
            tags
        );
    }

    #[test]
    fn test_link_anchor_not_tag() {
        // Markdown link: (#12-tab-可见性规则) — # is preceded by '(' not whitespace
        let line = "12. [Tab 可见性规则](#12-tab-可见性规则)";
        let mut tags = vec![];
        scan_tags_in_line(line, &mut tags);
        assert!(
            tags.is_empty(),
            "link anchor #12 should NOT be a tag, found: {:?}",
            tags
        );
    }

    #[test]
    fn hex_colors_not_tags() {
        let mut tags = vec![];
        // CSS-like contexts — semicolons / non-space after hex → filtered by boundary
        scan_tags_in_line("color: #488878;", &mut tags);
        scan_tags_in_line("bg: #9B7EE0 solid", &mut tags);
        // Valid tags (non-table lines — numeric tags OK)
        scan_tags_in_line("see #TaskOn here", &mut tags);
        scan_tags_in_line("ref #1 and #12 ok", &mut tags);
        assert_eq!(tags, vec!["TaskOn", "1", "12"]);
    }

    #[test]
    fn table_numeric_not_tags() {
        // Rankings and issue numbers in table rows should be excluded
        let mut tags = vec![];
        scan_tags_in_line("| P67 | #1 DeFi_Whale 12,800pts, #2 CryptoKing |", &mut tags);
        scan_tags_in_line("| #1 (center) | highest | amber |", &mut tags);
        scan_tags_in_line("| #26 Community Wizard preview |", &mut tags);
        // Non-table numeric tags still valid
        scan_tags_in_line("see #12 here", &mut tags);
        assert_eq!(tags, vec!["12"]);
    }

    #[test]
    fn hex_colors_in_table_not_tags() {
        // Exact user-reported line: hex colors in markdown table cells, no backticks
        let line = "| Theme | Dark (#0A0F1A bg, #111B27 cards) |";
        let mut tags = vec![];
        scan_tags_in_line(line, &mut tags);
        assert!(
            tags.is_empty(),
            "hex colors in table should NOT be tags, but found: {:?}",
            tags
        );
    }

    #[test]
    fn test_body_tags_skip_table_inline_code() {
        let body = "\
| 属性 | 值 |
|------|-----|
| 页面背景 | `#0A0F1A` (深色) |
| Header 背景 | `#0F172A` |
| 卡片背景 | `#111B27` |
| 边框 | `#1E293B` |
| Primary 强调色 | `#F59E0B` (amber) |
| 主文本 | `#F1F5F9` |
| 次级文本 | `#94A3B8` |
| 按钮主色 | `#F59E0B` fill, `#000000` text |
| 状态绿 | `#48BB78` (completed/claimed) |
| 状态灰 | `#64748B` (locked/disabled) |
";
        let tags = extract_body_tags(body);
        let hex_tags: Vec<&String> = tags.iter().filter(|t| t.chars().all(|c| c.is_ascii_hexdigit())).collect();
        assert!(
            hex_tags.is_empty(),
            "hex color codes inside backticks should NOT be tags, but found: {:?}",
            hex_tags
        );
    }

    // -----------------------------------------------------------------------
    // F3 — typed relationships extraction (mirrors lib/relationships.ts).
    // -----------------------------------------------------------------------

    fn fm(yaml: &str) -> serde_json::Value {
        serde_yaml::from_str::<serde_json::Value>(yaml).unwrap_or(serde_json::Value::Null)
    }

    #[test]
    fn relationships_scalar_and_array() {
        let v = fm("belongs_to: \"[[b]]\"\ncites:\n  - \"[[a]]\"\n  - \"[[c]]\"");
        let rel = extract_relationships(&v);
        assert_eq!(rel.get("belongs_to").unwrap(), &vec!["[[b]]".to_string()]);
        assert_eq!(
            rel.get("cites").unwrap(),
            &vec!["[[a]]".to_string(), "[[c]]".to_string()]
        );
    }

    #[test]
    fn relationships_arbitrary_custom_key() {
        let v = fm("author: \"[[jane]]\"");
        let rel = extract_relationships(&v);
        assert_eq!(rel.get("author").unwrap(), &vec!["[[jane]]".to_string()]);
    }

    #[test]
    fn relationships_reserved_keys_excluded() {
        let v = fm("title: \"[[x]]\"\ntags:\n  - \"[[y]]\"\nrelated_to: \"[[z]]\"");
        let rel = extract_relationships(&v);
        assert!(!rel.contains_key("title"));
        assert!(!rel.contains_key("tags"));
        assert_eq!(rel.get("related_to").unwrap(), &vec!["[[z]]".to_string()]);
    }

    #[test]
    fn relationships_underscore_prefixed_excluded() {
        let v = fm("_internal: \"[[a]]\"\ncites: \"[[b]]\"");
        let rel = extract_relationships(&v);
        assert!(!rel.contains_key("_internal"));
        assert!(rel.contains_key("cites"));
    }

    #[test]
    fn relationships_non_wikilink_ignored() {
        let v = fm("status: draft\ncount: 3\nbelongs_to: \"[[b]]\"");
        let rel = extract_relationships(&v);
        assert_eq!(rel.len(), 1);
        assert!(rel.contains_key("belongs_to"));
    }

    #[test]
    fn relationships_alias_heading_collapse() {
        let v = fm("ref: \"[[Paper A|the paper]]\"\nsee: \"[[Doc#Heading]]\"");
        let rel = extract_relationships(&v);
        assert_eq!(rel.get("ref").unwrap(), &vec!["[[Paper A]]".to_string()]);
        assert_eq!(rel.get("see").unwrap(), &vec!["[[Doc]]".to_string()]);
    }

    #[test]
    fn is_reserved_key_matches_ts_set() {
        assert!(is_reserved_key("_foo"));
        assert!(is_reserved_key("Title"));
        assert!(is_reserved_key("CSSClass"));
        assert!(!is_reserved_key("belongs_to"));
        assert!(!is_reserved_key("cites"));
    }

    #[test]
    fn parse_ref_target_strips_brackets() {
        assert_eq!(parse_ref_target("[[b]]"), "b");
        assert_eq!(parse_ref_target("[[a|alias]]"), "a");
        assert_eq!(parse_ref_target("[[a#h]]"), "a");
        assert_eq!(parse_ref_target("plain"), "plain");
    }

    /// Build a synthetic index in STATE and assert referenced_by resolves the
    /// inverse edges (stem + self-exclusion). Uses the real STATE lock so the
    /// command path is exercised end-to-end.
    #[test]
    fn referenced_by_resolves_inverse_with_self_exclusion() {
        fn entry(stem: &str, fm_yaml: &str) -> IndexEntry {
            let fmv = fm(fm_yaml);
            IndexEntry {
                path: format!("/{stem}.md"),
                name: format!("{stem}.md"),
                stem: stem.to_string(),
                mtime: 0,
                size: 0,
                relationships: extract_relationships(&fmv),
                frontmatter: fmv,
                wikilinks: vec![],
                tags: vec![],
                headings: vec![],
                tasks: vec![],
                summary: String::new(),
                title: None,
            }
        }
        {
            let mut s = STATE.write().unwrap();
            s.entries.clear();
            for e in [
                entry("a", "belongs_to: \"[[b]]\"\ncites: \"[[c]]\"\nself: \"[[a]]\""),
                entry("b", ""),
                entry("c", ""),
            ] {
                s.entries.insert(PathBuf::from(&e.path), e);
            }
        }

        let b_inv = workspace_index_referenced_by("b".into()).unwrap();
        assert_eq!(b_inv.len(), 1);
        assert_eq!(b_inv[0].from_path, "/a.md");
        assert_eq!(b_inv[0].via_key, "belongs_to");

        let c_inv = workspace_index_referenced_by("c".into()).unwrap();
        assert_eq!(c_inv.len(), 1);
        assert_eq!(c_inv[0].via_key, "cites");

        // a.md's self-reference must NOT show up as an inverse on a.md.
        let a_inv = workspace_index_referenced_by("a".into()).unwrap();
        assert!(a_inv.is_empty(), "self-reference must be excluded: {a_inv:?}");

        // --- Second scenario (same test fn so the two never race over the
        // shared STATE lock, which cargo would otherwise run in parallel) ---
        fn entry_titled(stem: &str, title: Option<&str>, fm_yaml: &str) -> IndexEntry {
            let fmv = fm(fm_yaml);
            IndexEntry {
                path: format!("/{stem}.md"),
                name: format!("{stem}.md"),
                stem: stem.to_string(),
                mtime: 0,
                size: 0,
                relationships: extract_relationships(&fmv),
                frontmatter: fmv,
                wikilinks: vec![],
                tags: vec![],
                headings: vec![],
                tasks: vec![],
                summary: String::new(),
                title: title.map(|s| s.to_string()),
            }
        }
        {
            let mut s = STATE.write().unwrap();
            s.entries.clear();
            for e in [
                entry_titled("a", None, "related_to: \"[[The Topic]]\""),
                entry_titled("t", Some("The Topic"), ""),
            ] {
                s.entries.insert(PathBuf::from(&e.path), e);
            }
        }
        let t_inv = workspace_index_referenced_by("The Topic".into()).unwrap();
        assert_eq!(t_inv.len(), 1, "title resolution: {t_inv:?}");
        assert_eq!(t_inv[0].from_path, "/a.md");
        assert_eq!(t_inv[0].via_key, "related_to");

        // Cleanup so we don't leak state into other tests.
        STATE.write().unwrap().entries.clear();
    }
