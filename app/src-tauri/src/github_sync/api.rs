use super::*;

// ---------------------------------------------------------------------------
// REST API: /user, /user/repos, POST /user/repos
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
pub struct GitHubUser {
    pub login: String,
    /// Gitea returns `full_name` instead of `name` — alias handles both.
    #[serde(alias = "full_name")]
    pub name: Option<String>,
    pub avatar_url: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GitHubRepo {
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub private: bool,
    pub default_branch: String,
    pub html_url: String,
    pub updated_at: String,
}

pub(super) async fn api_get<T: for<'de> Deserialize<'de>>(path: &str, token: &str) -> Result<T, String> {
    let url = format!("{}{}", GITHUB_API, path);
    let res = reqwest::Client::new()
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {}: {}", status, body));
    }
    res.json::<T>().await.map_err(|e| e.to_string())
}

pub(super) async fn api_post<B: Serialize, T: for<'de> Deserialize<'de>>(
    path: &str,
    token: &str,
    body: &B,
) -> Result<T, String> {
    let url = format!("{}{}", GITHUB_API, path);
    let res = reqwest::Client::new()
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("User-Agent", USER_AGENT)
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("GitHub API {}: {}", status, body));
    }
    res.json::<T>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_user() -> Result<GitHubUser, String> {
    let token = read_token()?.ok_or("no GitHub token set")?;
    api_get("/user", &token).await
}

#[tauri::command]
pub async fn github_list_repos() -> Result<Vec<GitHubRepo>, String> {
    let token = read_token()?.ok_or("no GitHub token set")?;
    // 100 most-recently-updated owned repos. Plenty for picker UX.
    api_get("/user/repos?per_page=100&sort=updated&affiliation=owner", &token).await
}

#[derive(Serialize)]
pub(super) struct CreateRepoRequest<'a> {
    pub(super) name: &'a str,
    pub(super) private: bool,
    pub(super) auto_init: bool,
    pub(super) description: &'a str,
}

#[tauri::command]
pub async fn github_create_vault_repo(name: String, private: bool) -> Result<GitHubRepo, String> {
    let token = read_token()?.ok_or("no GitHub token set")?;
    let req = CreateRepoRequest {
        name: &name,
        private,
        // auto_init=true gives us an initial commit + main branch on the
        // remote, which simplifies the first push. Without it a brand-new
        // vault would have to push --set-upstream into nothing.
        auto_init: true,
        description: "Notes vault — synced by SoloMD",
    };
    api_post("/user/repos", &token, &req).await
}
