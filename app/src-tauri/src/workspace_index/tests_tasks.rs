use super::extract_tasks;

#[test]
fn finds_open_and_done_items_with_file_line_numbers() {
    let raw = "---\ntitle: x\n---\n\n# Heading\n\n- [ ] first\n- [x] second\n";
    let tasks = extract_tasks(raw);
    assert_eq!(tasks.len(), 2);
    // Line 7 in the FILE, not line 4 of the body — the panel rewrites the
    // checkbox on this line.
    assert_eq!(tasks[0].line, 7);
    assert_eq!(tasks[0].text, "first");
    assert!(!tasks[0].done);
    assert_eq!(tasks[1].line, 8);
    assert!(tasks[1].done);
}

#[test]
fn ignores_task_shaped_lines_inside_fenced_code() {
    let raw = "- [ ] real\n\n```sh\n- [ ] not a task\n```\n\n- [x] also real\n";
    let tasks = extract_tasks(raw);
    assert_eq!(
        tasks.iter().map(|t| t.text.as_str()).collect::<Vec<_>>(),
        vec!["real", "also real"]
    );
}

#[test]
fn ignores_front_matter_and_accepts_every_bullet_marker() {
    let raw = "---\nlist:\n  - [ ] not a task\n---\n* [ ] star\n+ [X] plus\n  - [ ] nested\n";
    let tasks = extract_tasks(raw);
    assert_eq!(
        tasks.iter().map(|t| (t.line, t.text.as_str(), t.done)).collect::<Vec<_>>(),
        vec![(5, "star", false), (6, "plus", true), (7, "nested", false)]
    );
}

#[test]
fn a_bare_checkbox_with_no_text_is_not_a_task() {
    assert!(extract_tasks("- [ ]\n- [ ]   \n").is_empty());
}

#[test]
fn keeps_priority_and_due_tokens_for_the_frontend_to_parse() {
    let tasks = extract_tasks("- [ ] ship it ⏫ 📅 2026-09-10\n");
    assert_eq!(tasks[0].text, "ship it ⏫ 📅 2026-09-10");
}
