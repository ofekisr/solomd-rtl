use std::collections::HashSet;
use std::fs::{self, DirEntry};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use super::portable;

const MAX_FILES: usize = 64;
const MAX_FILE_BYTES: u64 = 1024 * 1024;
const MAX_DIRECTIVES: usize = 512;
const MAX_VALUES: usize = 512;
const MAX_STRING_SCALARS: usize = 1024;

#[derive(Clone, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveGrammar {
    pub opening: String,
    pub marker: String,
    pub closing: String,
    pub pair_separator: String,
    pub key_value_separator: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveDefinition {
    pub key: String,
    #[serde(rename = "type")]
    pub directive_type: String,
    #[serde(default)]
    pub values: Vec<String>,
    pub default: Option<String>,
    pub label: Option<String>,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedDirectiveCompletionManifest {
    #[serde(default)]
    pub source_file: String,
    pub schema_version: u32,
    pub grammar: DirectiveGrammar,
    pub directives: Vec<DirectiveDefinition>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveCompletionWarning {
    pub source_file: String,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveCompletionLoadResult {
    pub directory: String,
    pub manifests: Vec<LoadedDirectiveCompletionManifest>,
    pub warnings: Vec<DirectiveCompletionWarning>,
}

#[tauri::command]
pub fn directive_completions_load(app: AppHandle) -> Result<DirectiveCompletionLoadResult, String> {
    let directory = completions_dir(&app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("create completions directory: {error}"))?;
    Ok(load_from_dir(&directory))
}

#[tauri::command]
pub fn directive_completions_open_folder(app: AppHandle) -> Result<String, String> {
    let directory = completions_dir(&app)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("create completions directory: {error}"))?;
    app.opener()
        .open_path(directory.display().to_string(), None::<&str>)
        .map_err(|error| format!("open completions directory: {error}"))?;
    Ok(directory.display().to_string())
}

fn completions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    portable::app_data_dir(app.path())
        .map(|path| path.join("completions"))
        .map_err(|error| format!("resolve completions directory: {error}"))
}

fn load_from_dir(directory: &Path) -> DirectiveCompletionLoadResult {
    let directory_name = directory.display().to_string();
    let entries = match discover_entries(directory) {
        Ok(entries) => entries,
        Err(reason) => {
            return DirectiveCompletionLoadResult {
                directory: directory_name,
                manifests: Vec::new(),
                warnings: vec![warning(".", reason)],
            };
        }
    };
    load_entries_with_reader(directory_name, entries, |path| fs::read_to_string(path))
}

fn discover_entries(directory: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(directory).map_err(|error| error.to_string())?;
    for result in read_dir {
        let entry = result.map_err(|error| error.to_string())?;
        if !is_regular_json(&entry)? {
            continue;
        }
        let Some(file_name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        entries.push((file_name, entry.path()));
    }
    entries.sort_by(|left, right| left.0.cmp(&right.0));
    Ok(entries)
}

fn is_regular_json(entry: &DirEntry) -> Result<bool, String> {
    let file_type = entry.file_type().map_err(|error| error.to_string())?;
    Ok(file_type.is_file()
        && entry
            .path()
            .extension()
            .is_some_and(|value| value == "json"))
}

fn load_entries_with_reader<F>(
    directory: String,
    entries: Vec<(String, PathBuf)>,
    mut read: F,
) -> DirectiveCompletionLoadResult
where
    F: FnMut(&Path) -> std::io::Result<String>,
{
    let mut manifests = Vec::new();
    let mut warnings = Vec::new();
    let mut accepted = HashSet::<(DirectiveGrammar, String)>::new();

    for (index, (source_file, path)) in entries.into_iter().enumerate() {
        if index >= MAX_FILES {
            warnings.push(warning(
                &source_file,
                format!("file limit {MAX_FILES} exceeded"),
            ));
            continue;
        }
        match load_manifest(&source_file, &path, &mut read) {
            Ok(mut manifest) => {
                manifest.directives.retain(|directive| {
                    let identity = (manifest.grammar.clone(), directive.key.clone());
                    if accepted.insert(identity) {
                        true
                    } else {
                        warnings.push(warning(
                            &source_file,
                            format!("duplicate directive key ignored: {}", directive.key),
                        ));
                        false
                    }
                });
                if !manifest.directives.is_empty() {
                    manifests.push(manifest);
                }
            }
            Err(reason) => warnings.push(warning(&source_file, reason)),
        }
    }

    DirectiveCompletionLoadResult {
        directory,
        manifests,
        warnings,
    }
}

fn load_manifest<F>(
    source_file: &str,
    path: &Path,
    read: &mut F,
) -> Result<LoadedDirectiveCompletionManifest, String>
where
    F: FnMut(&Path) -> std::io::Result<String>,
{
    let size = fs::metadata(path).map_err(|error| error.to_string())?.len();
    if size > MAX_FILE_BYTES {
        return Err(format!("file exceeds {MAX_FILE_BYTES} bytes"));
    }
    let contents = read(path).map_err(|error| error.to_string())?;
    if contents.len() as u64 > MAX_FILE_BYTES {
        return Err(format!("file exceeds {MAX_FILE_BYTES} bytes"));
    }
    let mut manifest: LoadedDirectiveCompletionManifest =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;
    manifest.source_file = source_file.to_owned();
    validate_manifest(&manifest)?;
    Ok(manifest)
}

fn validate_manifest(manifest: &LoadedDirectiveCompletionManifest) -> Result<(), String> {
    if manifest.schema_version != 1 {
        return Err(format!(
            "unsupported schemaVersion: {}",
            manifest.schema_version
        ));
    }
    validate_required("grammar.opening", &manifest.grammar.opening)?;
    validate_required("grammar.marker", &manifest.grammar.marker)?;
    validate_required("grammar.closing", &manifest.grammar.closing)?;
    validate_required("grammar.pairSeparator", &manifest.grammar.pair_separator)?;
    validate_required(
        "grammar.keyValueSeparator",
        &manifest.grammar.key_value_separator,
    )?;
    if manifest.directives.len() > MAX_DIRECTIVES {
        return Err(format!("manifest exceeds {MAX_DIRECTIVES} directives"));
    }

    let mut keys = HashSet::new();
    for directive in &manifest.directives {
        validate_required("directive.key", &directive.key)?;
        validate_required("directive.type", &directive.directive_type)?;
        if !keys.insert(&directive.key) {
            return Err(format!("duplicate directive key: {}", directive.key));
        }
        if directive.values.len() > MAX_VALUES {
            return Err(format!(
                "directive {} exceeds {MAX_VALUES} values",
                directive.key
            ));
        }
        for value in &directive.values {
            validate_string("directive value", value)?;
        }
        for (name, value) in [
            ("directive.default", directive.default.as_deref()),
            ("directive.label", directive.label.as_deref()),
            ("directive.description", directive.description.as_deref()),
        ] {
            if let Some(value) = value {
                validate_string(name, value)?;
            }
        }
    }
    Ok(())
}

fn validate_required(name: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{name} must not be empty"));
    }
    validate_string(name, value)
}

fn validate_string(name: &str, value: &str) -> Result<(), String> {
    if value.chars().count() > MAX_STRING_SCALARS {
        return Err(format!(
            "{name} exceeds {MAX_STRING_SCALARS} Unicode scalars"
        ));
    }
    Ok(())
}

fn warning(source_file: &str, reason: impl Into<String>) -> DirectiveCompletionWarning {
    DirectiveCompletionWarning {
        source_file: source_file.to_owned(),
        reason: reason.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Error, ErrorKind};
    use std::sync::atomic::{AtomicU64, Ordering};

    static FIXTURE_COUNTER: AtomicU64 = AtomicU64::new(0);

    const VALID_MANIFEST: &str = r#"{
      "schemaVersion":1,
      "grammar":{"opening":"<!--","marker":"epub:","closing":"-->","pairSeparator":",","keyValueSeparator":"="},
      "directives":[{"key":"style","type":"enum","values":["chapter"],"default":"chapter"}]
    }"#;

    struct FixtureDir(PathBuf);

    impl FixtureDir {
        fn new(name: &str) -> Self {
            let sequence = FIXTURE_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "solomd-directive-completions-{name}-{}-{sequence}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn write(&self, name: &str, contents: impl AsRef<[u8]>) {
            fs::write(self.0.join(name), contents).unwrap();
        }
    }

    impl Drop for FixtureDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn loads_valid_files_in_filename_order_and_ignores_unknown_fields() {
        let dir = FixtureDir::new("ordered");
        dir.write(
            "b.json",
            r#"{"schemaVersion":1,"futureTopLevel":true,"grammar":{"opening":"<!--","marker":"b:","closing":"-->","pairSeparator":",","keyValueSeparator":"=","futureGrammar":"ok"},"directives":[{"key":"beta","type":"future","values":["x"],"futureDirective":9}]}"#,
        );
        dir.write("a.json", VALID_MANIFEST);

        let result = load_from_dir(&dir.0);

        let files: Vec<_> = result
            .manifests
            .iter()
            .map(|manifest| manifest.source_file.as_str())
            .collect();
        assert_eq!(files, ["a.json", "b.json"]);
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn keeps_valid_files_when_neighbors_are_invalid_or_not_files() {
        let dir = FixtureDir::new("partial");
        dir.write("good.json", VALID_MANIFEST);
        dir.write("bad.json", "{");
        fs::create_dir(dir.0.join("not-a-file.json")).unwrap();

        let result = load_from_dir(&dir.0);

        assert_eq!(result.manifests.len(), 1);
        assert_eq!(result.warnings.len(), 1);
    }

    #[test]
    fn read_failure_after_enumeration_warns_and_continues() {
        let dir = FixtureDir::new("read-failure");
        dir.write("bad.json", VALID_MANIFEST);
        dir.write("good.json", VALID_MANIFEST.replace("epub:", "other:"));
        let entries = discover_entries(&dir.0).unwrap();
        let result = load_entries_with_reader("fixture".into(), entries, |path| {
            if path.file_name().is_some_and(|name| name == "bad.json") {
                return Err(Error::new(ErrorKind::PermissionDenied, "denied"));
            }
            fs::read_to_string(path)
        });

        assert_eq!(result.manifests.len(), 1);
        assert_eq!(result.warnings.len(), 1);
        assert_eq!(result.warnings[0].source_file, "bad.json");
    }

    #[test]
    fn rejects_a_file_that_grows_after_the_metadata_check() {
        let dir = FixtureDir::new("growing-file");
        dir.write("growing.json", VALID_MANIFEST);
        let entries = discover_entries(&dir.0).unwrap();

        let result = load_entries_with_reader("fixture".into(), entries, |_| {
            Ok("x".repeat(MAX_FILE_BYTES as usize + 1))
        });

        assert!(result.manifests.is_empty());
        assert_eq!(result.warnings.len(), 1);
        assert!(result.warnings[0].reason.contains("exceeds"));
    }

    #[cfg(unix)]
    #[test]
    fn ignores_json_symlinks_instead_of_following_them() {
        use std::os::unix::fs::symlink;

        let dir = FixtureDir::new("symlink");
        let outside = FixtureDir::new("outside");
        outside.write("outside.json", VALID_MANIFEST);
        symlink(outside.0.join("outside.json"), dir.0.join("linked.json")).unwrap();

        let result = load_from_dir(&dir.0);

        assert!(result.manifests.is_empty());
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn first_filename_wins_only_for_identical_grammar_and_key() {
        let dir = FixtureDir::new("duplicates");
        dir.write("a.json", VALID_MANIFEST);
        dir.write("b.json", VALID_MANIFEST.replace("chapter", "second"));
        dir.write("c.json", VALID_MANIFEST.replace("epub:", "other:"));

        let result = load_from_dir(&dir.0);

        assert_eq!(result.manifests.len(), 2);
        assert_eq!(result.warnings.len(), 1);
        assert_eq!(result.warnings[0].source_file, "b.json");
    }

    #[test]
    fn rejects_schema_shape_and_in_manifest_duplicate_errors() {
        let duplicate =
            VALID_MANIFEST.replace("]\n    }", ",{\"key\":\"style\",\"type\":\"enum\"}]\n    }");
        let cases = [
            (
                "schema.json",
                VALID_MANIFEST.replace("\"schemaVersion\":1", "\"schemaVersion\":2"),
            ),
            (
                "missing.json",
                VALID_MANIFEST.replace("\"opening\":\"<!--\",", ""),
            ),
            (
                "empty.json",
                VALID_MANIFEST.replace("\"marker\":\"epub:\"", "\"marker\":\"\""),
            ),
            ("duplicate.json", duplicate),
        ];
        for (name, contents) in cases {
            let dir = FixtureDir::new(name);
            dir.write(name, contents);
            let result = load_from_dir(&dir.0);
            assert!(result.manifests.is_empty(), "{name}");
            assert_eq!(result.warnings.len(), 1, "{name}");
        }
    }

    #[test]
    fn enforces_file_directive_value_and_scalar_limits() {
        let cases = [
            ("large.json", "x".repeat(MAX_FILE_BYTES as usize + 1)),
            (
                "directives.json",
                manifest_with_directives(MAX_DIRECTIVES + 1),
            ),
            ("values.json", manifest_with_values(MAX_VALUES + 1)),
            (
                "scalar.json",
                VALID_MANIFEST.replace("style", &"x".repeat(MAX_STRING_SCALARS + 1)),
            ),
        ];
        for (name, contents) in cases {
            let dir = FixtureDir::new(name);
            dir.write(name, contents);
            let result = load_from_dir(&dir.0);
            assert!(result.manifests.is_empty(), "{name}");
            assert_eq!(result.warnings.len(), 1, "{name}");
        }
    }

    #[test]
    fn loads_only_the_first_sixty_four_sorted_files() {
        let dir = FixtureDir::new("file-limit");
        for index in 0..=MAX_FILES {
            let manifest = VALID_MANIFEST.replace("epub:", &format!("marker-{index}:"));
            dir.write(&format!("{index:02}.json"), manifest);
        }

        let result = load_from_dir(&dir.0);

        assert_eq!(result.manifests.len(), MAX_FILES);
        assert_eq!(result.warnings.len(), 1);
        assert_eq!(result.warnings[0].source_file, "64.json");
    }

    #[test]
    fn accepts_default_absent_from_values_without_inventing_it() {
        let dir = FixtureDir::new("default");
        let manifest = VALID_MANIFEST
            .replace("\"chapter\"]", "\"one\"]")
            .replace("\"default\":\"chapter\"", "\"default\":\"missing\"");
        dir.write("default.json", manifest);

        let result = load_from_dir(&dir.0);

        assert_eq!(result.manifests[0].directives[0].values, ["one"]);
        assert_eq!(
            result.manifests[0].directives[0].default.as_deref(),
            Some("missing")
        );
    }

    fn manifest_with_directives(count: usize) -> String {
        let directives = (0..count)
            .map(|index| format!(r#"{{"key":"key-{index}","type":"text"}}"#))
            .collect::<Vec<_>>()
            .join(",");
        VALID_MANIFEST.replace(
            r#"{"key":"style","type":"enum","values":["chapter"],"default":"chapter"}"#,
            &directives,
        )
    }

    fn manifest_with_values(count: usize) -> String {
        let values = (0..count)
            .map(|index| format!(r#""value-{index}""#))
            .collect::<Vec<_>>()
            .join(",");
        VALID_MANIFEST.replace(r#""chapter""#, &values)
    }
}
