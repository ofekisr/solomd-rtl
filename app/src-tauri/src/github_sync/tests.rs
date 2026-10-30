use super::owner_from_url;

#[test]
fn extracts_the_account_segment() {
    assert_eq!(
        owner_from_url("https://gitee.com/zhitong45/notes.git").as_deref(),
        Some("zhitong45")
    );
    assert_eq!(
        owner_from_url("https://github.com/octocat/hello.git").as_deref(),
        Some("octocat")
    );
    // Self-hosted forge under its own domain behaves the same.
    assert_eq!(
        owner_from_url("https://git.example.com/team/repo.git").as_deref(),
        Some("team")
    );
}

#[test]
fn rejects_urls_without_an_owner() {
    assert_eq!(owner_from_url("https://gitee.com/").as_deref(), None);
    assert_eq!(owner_from_url("https://gitee.com").as_deref(), None);
    assert_eq!(owner_from_url("not a url").as_deref(), None);
}
