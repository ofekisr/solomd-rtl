#[path = "commands/mod.rs"]
mod commands;

mod events;
mod language;
mod menu;
mod window;

#[path = "image_upload/mod.rs"]
mod image_upload;

#[path = "search.rs"]
mod search;

#[path = "replace.rs"]
mod replace;

#[path = "mmap_text.rs"]
mod mmap_text;

#[path = "md_code_spans.rs"]
mod md_code_spans;

#[path = "set_default.rs"]
mod set_default;

#[path = "convert/mod.rs"]
mod convert;

#[path = "workspace_index/mod.rs"]
mod workspace_index;

#[path = "spellcheck.rs"]
mod spellcheck;

#[path = "directive_completions.rs"]
mod directive_completions;

// #102 — AI key storage abstraction; declared before ai_proxy which uses it.
#[path = "ai_keystore.rs"]
mod ai_keystore;

#[path = "ai_proxy.rs"]
mod ai_proxy;

#[path = "pandoc.rs"]
mod pandoc;

#[path = "git_history.rs"]
mod git_history;

// v2.4 inbound HTTP capture endpoint — production-grade, opt-in via Settings.
#[path = "capture_endpoint/mod.rs"]
mod capture_endpoint;

// Quick capture — global hotkey → mini window → Inbox note. Writes through
// capture_endpoint's note builder, so it must be declared alongside it here
// (the binary's real invoke handler lives in this file, not lib.rs).
#[path = "quick_capture.rs"]
mod quick_capture;

// v4.0 — public REST API mirroring the agent_tools surface for non-MCP
// clients. Declared in both lib.rs and runner.rs so the binary's compile
// root resolves `crate::rest_api` the same way the lib does.
#[path = "rest_api/mod.rs"]
mod rest_api;
// v4.0 — BYOK cost meter. Same dual-declaration as rest_api: agent_run
// references `crate::cost_meter::record`, which must resolve in both
// the lib (for tests) and the bin (for live recipe + chat finishes).
#[path = "cost_meter.rs"]
mod cost_meter;

// v2.5 community theme marketplace — see app/src-tauri/src/themes.rs.
#[path = "themes.rs"]
mod themes;

// v2.5 CJK proofread — flags common Chinese typos with one-click fixes.
#[path = "cjk_proofread.rs"]
mod cjk_proofread;

// v2.6 GitHub-backed sync — push/pull a workspace to a user-owned GitHub repo.
#[path = "github_sync/mod.rs"]
mod github_sync;

// v2.6.1 cloud-folder detection + cross-device session restore.
#[path = "cloud_folder.rs"]
mod cloud_folder;

// v2.6.3 workspace-level E2EE.
#[path = "crypto/mod.rs"]
mod crypto;

// v2.3 dev WebDriver bridge — debug builds only. Module file itself is
// `#[cfg(debug_assertions)]`-gated, so this `mod` line is too.
#[cfg(debug_assertions)]
#[path = "dev_bridge.rs"]
mod dev_bridge;

#[path = "watcher.rs"]
mod watcher;

// v4.0 Pillar 1 — agent tool registry + run-dir persistence.
#[path = "agent_run.rs"]
mod agent_run;
#[path = "agent_tools.rs"]
mod agent_tools;
// v4.0 — provider pricing table for cost estimates.
#[path = "pricing.rs"]
mod pricing;
// v4.0 Pillar 3 — canonical trace emitter + reader + Tauri wrappers.
#[path = "trace.rs"]
mod trace;
#[path = "agent_trace.rs"]
mod agent_trace;
// v4.0 Pillar 5 — Ollama polish (detect / pull / install-page).
#[path = "ollama.rs"]
mod ollama;
// v4.0 Pillar 4 — MCP federation profile storage.
#[path = "mcp_profiles.rs"]
mod mcp_profiles;
// v4.0 Pillar 2 — Agent Recipes. Declared here in addition to lib.rs so
// the desktop binary (driven from `main.rs` → `runner.rs`) picks them
// up. `commands.rs` and `git_history.rs` reference
// `crate::recipe_runner::*`, which must resolve in both compilation
// roots (the lib AND the bin).
#[path = "recipes.rs"]
mod recipes;
#[path = "recipe_runner.rs"]
mod recipe_runner;
// v4.0 — bundled recipe cookbook (10+ ready-to-edit YAML templates).
#[path = "cookbook.rs"]
mod cookbook;

// v2.4 — integrations panel (CLI status, MCP path, AI-client config
// discovery) + v4.4.5 MCP auto-install (detect_ai_clients / inject_mcp /
// remove_mcp). Was historically only declared in lib.rs (the mobile entry
// point), so the desktop binary's frontend couldn't reach any of the
// commands. Adding the path here too is the same dual-declaration trick
// recipe_runner and rest_api use to live in both compilation roots.
#[path = "integrations/mod.rs"]
mod integrations;

// v2.3 RAG / semantic search. Same dual-declaration pattern — surfaced
// as bug #94 ("Command rag_reindex not found"): the rag::* commands
// were only in lib.rs, so the desktop Settings → Integrations →
// "Re-index now" button always hit a "command not found" wall.
#[path = "rag.rs"]
mod rag;

// v4.1 — About-dialog build-info command. Same dual-declaration gap as
// rag — registered in lib.rs only, missing from the desktop runner,
// so the About panel's build details fell back silently on desktop.
#[path = "app_build.rs"]
mod app_build;
// #295 — Windows portable mode (`data` folder next to the exe).
#[path = "portable.rs"]
mod portable;

// Windows frameless chrome: WM_NCHITTEST → HTMAXBUTTON for Snap Layouts.
#[cfg(target_os = "windows")]
#[path = "win_chrome.rs"]
mod win_chrome;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub struct PendingOpen(pub Mutex<Vec<String>>);

/// Command: returns all paths queued by macOS Apple Events / CLI args
/// and clears the buffer. Called by the frontend on mount — this prevents
/// the race where the "opened" event fires before the JS listener exists.
#[tauri::command]
fn drain_pending_opens(state: tauri::State<PendingOpen>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap();
    std::mem::take(&mut *guard)
}

pub fn run_with(initial_file: Option<String>) {
    let pending: Vec<String> = initial_file.into_iter().collect();

    // IMPORTANT: must be called BEFORE NSApplication loads (i.e. before
    // `tauri::Builder::default()` below) so AppKit picks up the locale
    // for all system panels.
    let saved_lang = language::read_saved_language();
    language::apply_macos_language(&saved_lang);

    // #295 — before any webview exists: with a `data` folder next to
    // SoloMD.exe, WebView2 and our config files live there. No-op elsewhere.
    portable::init();

    let builder = tauri::Builder::default();

    // #86/#87(1) — single-instance must register BEFORE any other plugin so
    // its handler hooks into the OS' "another instance launching" signal
    // before the rest of the app starts initialising. The second launch
    // reactivates the existing main window and routes any file argument
    // through the existing `solomd://opened-file` channel that App.vue
    // already listens on (used by the OS file association too).
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(
        |app: &tauri::AppHandle, argv: Vec<String>, _cwd: String| {
            use tauri::Emitter;
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
            for arg in argv.iter().skip(1) {
                if !arg.is_empty() && !arg.starts_with('-') {
                    let _ = app.emit("solomd://opened-file", arg.clone());
                }
            }
        },
    ));

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // v4.3.x — issue #56 reopen: the original fix landed in `lib.rs::run`
    // but `main.rs` calls `runner::run_with` instead, so the StateFlags::all()
    // call there was never reached. The plugin's default StateFlags is
    // `POSITION | SIZE` — missing MAXIMIZED + FULLSCREEN + DECORATIONS,
    // which is why Windows users kept seeing the maximized state forgotten
    // on relaunch. Patch this site (the live one) too.
    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            // NOT ::all(): DECORATIONS must never be restored from disk — the
            // frameless Windows build (decorations:false, unified title bar)
            // would get the native title bar resurrected by state saved from
            // a pre-4.12 decorated install. Decorations are config-owned.
            .with_state_flags(
                tauri_plugin_window_state::StateFlags::all()
                    - tauri_plugin_window_state::StateFlags::DECORATIONS,
            )
            // The quick-capture box is undecorated, fixed-size and always on
            // top by design; restoring a remembered geometry would hand it a
            // stale position on the next launch.
            .with_denylist(&[quick_capture::CAPTURE_LABEL])
            .build(),
    );

    // Quick capture's system-wide hotkey. Registration itself happens later,
    // from the frontend, because the chord is a user setting.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());

    let app = builder
        .manage(PendingOpen(Mutex::new(pending)))
        .manage(watcher::WatcherState::new())
        .manage(recipe_runner::RecipesState::new())
        .manage(crate::git_pane::commands::GitPaneState::default())
        .invoke_handler(tauri::generate_handler![
            commands::file_io::read_file,
            commands::file_io::read_binary_file,
            commands::file_io::write_file,
            commands::file_io::write_binary_file,
            commands::print::print_webview,
            commands::fs_ops::copy_file,
            image_upload::upload_image,
            commands::list_dir::list_dir,
            commands::fs_ops::fs_create_file,
            commands::fs_ops::fs_create_dir,
            commands::fs_ops::fs_delete,
            commands::fs_ops::fs_dir_exists,
            commands::fs_ops::fs_file_exists,
            commands::fs_ops::fs_rename,
            commands::fs_move::fs_move,
            commands::fs_list::fs_list_dirs,
            commands::fs_list::fs_list_extensions,
            commands::fs_list::fs_dirs_with_extensions,
            search::search_in_dir,
            replace::replace_in_dir,
            replace::replace_in_text,
            drain_pending_opens,
            window::force_close_window,
            menu::set_menu_language,
            menu::set_menu_config,
            window::set_max_button_rect,
            language::save_language_preference,
            set_default::set_as_default_markdown_editor,
            convert::convert_file_to_markdown,
            workspace_index::commands::workspace_index_init,
            workspace_index::commands::workspace_index_files,
            workspace_index::commands::workspace_index_backlinks,
            workspace_index::commands::workspace_index_tags,
            workspace_index::commands::workspace_index_resolve,
            workspace_index::commands::workspace_index_rescan,
            // v4.6 — these were only registered in the dead-code lib.rs::run();
            // the desktop binary uses runner::run_with(), so the F1 property
            // writes + F3 inverse-relationship lookup 404'd at runtime until
            // registered here too. (Same class as the #94 rag::* omission.)
            workspace_index::commands::workspace_index_referenced_by,
            commands::frontmatter::update_frontmatter_property,
            commands::frontmatter::delete_frontmatter_property,
            spellcheck::spellcheck_init,
            spellcheck::spellcheck_check,
            spellcheck::spellcheck_suggest,
            spellcheck::spellcheck_add_to_dict,
            spellcheck::spellcheck_load_user_dict,
            spellcheck::spellcheck_list_dicts,
            spellcheck::spellcheck_dicts_dir,
            directive_completions::directive_completions_load,
            directive_completions::directive_completions_open_folder,
            ai_proxy::ai_set_key,
            ai_proxy::ai_has_key,
            ai_proxy::ai_clear_key,
            ai_proxy::ai_rewrite,
            ai_proxy::ai_chat,
            ai_proxy::ai_cancel,
            ai_proxy::ai_verify_key,
            ai_proxy::ai_list_models,
            pandoc::pandoc_detect,
            pandoc::pandoc_export,
            git_history::git_workspace_status,
            git_history::git_init_workspace,
            git_history::git_auto_commit,
            git_history::git_file_history,
            git_history::git_file_diff,
            git_history::git_file_at_version,
            git_history::git_rollback_file,
            crate::git_pane::commands::gitpane_version,
            crate::git_pane::commands::gitpane_open,
            crate::git_pane::commands::gitpane_snapshot,
            crate::git_pane::commands::gitpane_commit_page,
            crate::git_pane::commands::gitpane_diff,
            crate::git_pane::commands::gitpane_commit_files,
            crate::git_pane::commands::gitpane_execute,
            crate::git_pane::commands::gitpane_cancel,
            crate::git_pane::commands::gitpane_close,
            capture_endpoint::commands::capture_get_state,
            capture_endpoint::commands::capture_set_enabled,
            capture_endpoint::commands::capture_regenerate_token,
            capture_endpoint::commands::capture_set_inbox_folder,
            capture_endpoint::commands::capture_set_workspace,
            quick_capture::quick_capture_open,
            quick_capture::quick_capture_close,
            quick_capture::quick_capture_write,
            quick_capture::quick_capture_set_shortcut,
            rest_api::rest_get_state,
            rest_api::rest_set_enabled,
            rest_api::rest_regenerate_token,
            rest_api::rest_set_allow_write,
            rest_api::rest_set_workspace,
            cost_meter::cost_meter_get,
            cost_meter::cost_meter_reset,
            cost_meter::cost_meter_set_enabled,
            themes::theme_install,
            themes::theme_uninstall,
            themes::theme_list_installed,
            themes::theme_json_save,
            themes::theme_json_list,
            themes::theme_json_remove,
            cjk_proofread::cjk_proofread,
            github_sync::token::github_set_token,
            github_sync::token::github_clear_token,
            github_sync::token::github_has_token,
            github_sync::api::github_user,
            github_sync::api::github_list_repos,
            github_sync::api::github_create_vault_repo,
            github_sync::link::github_link_workspace,
            github_sync::link::github_set_config,
            github_sync::link::github_unlink_workspace,
            github_sync::link::github_enable_encryption,
            github_sync::status::github_sync_status,
            github_sync::push::github_push,
            github_sync::pull::github_pull,
            github_sync::resolve::github_resolve_conflict,
            github_sync::proxy::proxy_get,
            github_sync::proxy::proxy_set,
            // Gitea sync commands (v5.0)
            github_sync::gitea::gitea_set_token,
            github_sync::gitea::gitea_clear_token,
            github_sync::gitea::gitea_has_token,
            github_sync::gitea::gitea_get_url,
            github_sync::gitea::gitea_set_url,
            github_sync::gitea::gitea_validate_url,
            github_sync::gitea::gitea_user,
            github_sync::gitea::gitea_list_repos,
            github_sync::gitea::gitea_create_vault_repo,
            cloud_folder::cloud_folder_detect,
            cloud_folder::device_id_get_or_create,
            cloud_folder::session_save,
            cloud_folder::session_load,
            cloud_folder::session_list_others,
            crypto::crypto_status,
            crypto::crypto_set_passphrase,
            crypto::crypto_clear_passphrase,
            crypto::crypto_encrypt_for_push,
            crypto::crypto_decrypt_after_pull,
            watcher::watch_file,
            watcher::unwatch_file,
            agent_tools::agent_tool_list_notes,
            agent_tools::agent_tool_read_note,
            agent_tools::agent_tool_search,
            agent_tools::agent_tool_get_backlinks,
            agent_tools::agent_tool_list_tags,
            agent_tools::agent_tool_get_outline,
            agent_tools::agent_tool_autogit_log,
            agent_tools::agent_tool_autogit_diff,
            agent_tools::agent_tool_write_note,
            agent_tools::agent_tool_append_to_note,
            agent_tools::agent_tool_read_agent_trace,
            agent_tools::agent_list_runs,
            agent_trace::agent_trace_read,
            agent_trace::agent_trace_list,
            agent_trace::agent_trace_replay_from,
            ollama::ollama_detect,
            ollama::ollama_pull,
            ollama::ollama_cancel_pull,
            ollama::open_ollama_install_page,
            mcp_profiles::mcp_profiles_list,
            mcp_profiles::mcp_profiles_save,
            mcp_profiles::mcp_profiles_delete,
            mcp_profiles::mcp_profiles_export_config,
            integrations::cli_status,
            integrations::mcp_path,
            integrations::mcp_claude_desktop_config_path,
            integrations::detect_ai_clients,
            integrations::inject_mcp,
            integrations::remove_mcp,
            // #94 — desktop was missing rag::* (registered only in lib.rs).
            rag::rag_set_enabled,
            rag::rag_index_status,
            rag::rag_reindex,
            rag::rag_search,
            rag::rag_reindex_file,
            // about-dialog build info (was lib.rs-only too).
            app_build::app_build_info,
            recipe_runner::recipes_list,
            recipe_runner::recipes_get,
            recipe_runner::recipes_save,
            recipe_runner::recipes_delete,
            recipe_runner::recipes_run_now,
            recipe_runner::recipes_pending_runs,
            recipe_runner::recipes_history,
            recipe_runner::recipes_read_trace,
            recipe_runner::recipes_read_run_md,
            recipe_runner::recipes_run_diff,
            recipe_runner::recipes_accept_run,
            recipe_runner::recipes_reject_run,
            cookbook::cookbook_list,
            cookbook::cookbook_get,
            cookbook::cookbook_install,
        ])
        .on_menu_event(|app_handle, event| {
            // Forward every menu click to the frontend as a single event
            // with the menu item id as payload. App.vue dispatches actions
            // based on this id.
            let id = event.id().0.clone();
            let _ = app_handle.emit("solomd://menu", id);
        })
        .setup(|app| {
            // Build initial menu in English — the frontend will call
            // `set_menu_language` on mount to apply the user's saved preference.
            // Windows: no native menu — the frameless window renders its own
            // File/Edit/View/Help menubar inside the unified toolbar row.
            #[cfg(not(target_os = "windows"))]
            {
                let menu = menu::build_app_menu(app.handle(), "en", &std::collections::HashMap::new())?;
                app.set_menu(menu)?;
            }

            // The window-state plugin's restore_state is dispatched via
            // `run_on_main_thread`, so it doesn't fire until AFTER setup
            // returns AND after the run loop has started processing. Hook
            // the main window's first Resized OR Moved event — that's the
            // restore — and clamp at that moment. A second hook in the
            // run-loop event match (`RunEvent::Ready` + 400ms timer) acts
            // as a fallback when there's no saved state to restore.
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if matches!(
                        event,
                        tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_)
                    ) {
                        window::fit_main_window_once(&win_clone);
                    }
                });
                // Windows frameless chrome: Snap-Layouts hit-testing subclass.
                #[cfg(target_os = "windows")]
                win_chrome::install(&win, app.handle());
            }

            // NOTE: do NOT drain PendingOpen here. The frontend calls
            // `drain_pending_opens` on mount instead, which avoids the
            // race condition where the "opened-file" event fires before
            // the JS listener is ready (happens on macOS cold start).

            // v2.3: in debug builds, start the WebDriver bridge so
            // `solomd-dev-mcp` can drive the live UI from outside.
            // Release builds compile this out entirely.
            #[cfg(debug_assertions)]
            {
                dev_bridge::spawn(app.handle().clone());
            }

            // v4.0 Pillar 2 — start the cron-trigger loop. Sleeps until
            // a `schedule` recipe is due; harmless when no recipes are
            // loaded yet (the loop polls workspace state every minute
            // and recipes are loaded eagerly by `recipes_list`).
            recipe_runner::spawn_cron_loop(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(events::handle_run_event);
}
