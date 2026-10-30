#[cfg(not(target_os = "windows"))]
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadata, PredefinedMenuItem};

/// Menu strings (English only).
#[cfg(not(target_os = "windows"))]
struct MenuStrings {
    file: &'static str,
    edit: &'static str,
    view: &'static str,
    help: &'static str,
    new_md: &'static str,
    new_txt: &'static str,
    open_file: &'static str,
    open_folder: &'static str,
    import_docs: &'static str,
    save: &'static str,
    save_as: &'static str,
    print_item: &'static str,
    close_tab: &'static str,
    new_window: &'static str,
    open_external: &'static str,
    toggle_theme: &'static str,
    toggle_sidebar: &'static str,
    toggle_outline: &'static str,
    cycle_view: &'static str,
    // v4.3.0 PR #74 — 3-axis zoom (UI / Editor / Preview).
    ui_zoom_in: &'static str,
    ui_zoom_out: &'static str,
    ui_zoom_reset: &'static str,
    editor_zoom_in: &'static str,
    editor_zoom_out: &'static str,
    editor_zoom_reset: &'static str,
    preview_zoom_in: &'static str,
    preview_zoom_out: &'static str,
    preview_zoom_reset: &'static str,
    palette: &'static str,
    global_search: &'static str,
    settings_menu: &'static str,
    md_help: &'static str,
    about: &'static str,
    /// Only the Linux menu builds an Exit item (#272), so this is dead on
    /// macOS and Windows — where Quit lives in the app menu / Alt+F4.
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    exit: &'static str,
}

#[cfg(not(target_os = "windows"))]
fn strings_for(_lang: &str) -> MenuStrings {
    MenuStrings {
        file: "File",
        edit: "Edit",
        view: "View",
        help: "Help",
        new_md: "New Markdown",
        new_txt: "New Plain Text",
        open_file: "Open File…",
        open_folder: "Open Folder…",
        import_docs: "Import Documents…",
        save: "Save",
        save_as: "Save As…",
        print_item: "Print…",
        close_tab: "Close Tab",
        new_window: "New Window",
        open_external: "Open in External Editor",
        toggle_theme: "Toggle Theme",
        toggle_sidebar: "Toggle File Tree",
        toggle_outline: "Toggle Outline",
        cycle_view: "Cycle Edit/Split/Preview",
        ui_zoom_in: "UI: Zoom In",
        ui_zoom_out: "UI: Zoom Out",
        ui_zoom_reset: "UI: Reset Zoom",
        editor_zoom_in: "Editor: Zoom In",
        editor_zoom_out: "Editor: Zoom Out",
        editor_zoom_reset: "Editor: Reset Zoom",
        preview_zoom_in: "Preview: Zoom In",
        preview_zoom_out: "Preview: Zoom Out",
        preview_zoom_reset: "Preview: Reset Zoom",
        palette: "Command Palette",
        global_search: "Search in Folder…",
        settings_menu: "Settings…",
        md_help: "Markdown Cheatsheet",
        about: "About SoloMD",
        exit: "Exit",
    }
}

#[cfg(not(target_os = "windows"))]
pub(super) fn build_app_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    lang: &str,
    // #180 — the user's effective shortcut per menu-item id. A missing entry
    // keeps the built-in accelerator; an entry holding an empty string means
    // the action was rebound or unbound, so the item must carry NO
    // accelerator — otherwise macOS keeps firing the old chord from the menu
    // and "changing" a shortcut would only ever add a second one.
    accels: &std::collections::HashMap<String, String>,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let s = strings_for(lang);
    // Resolve an item's accelerator: user override, else the shipped default.
    macro_rules! accel {
        ($item:expr, $id:expr, $default:expr) => {{
            match accels.get($id).map(String::as_str) {
                Some("") => $item,
                Some(custom) => $item.accelerator(custom),
                None => $item.accelerator($default),
            }
        }};
    }

    let new_md = accel!(MenuItemBuilder::with_id("file.new", s.new_md), "file.new", "CmdOrCtrl+N")
        .build(app)?;
    let new_txt = accel!(MenuItemBuilder::with_id("file.newText", s.new_txt), "file.newText", "CmdOrCtrl+Alt+N")
        .build(app)?;
    let open_file = accel!(MenuItemBuilder::with_id("file.open", s.open_file), "file.open", "CmdOrCtrl+O")
        .build(app)?;
    let open_folder = MenuItemBuilder::with_id("file.openFolder", s.open_folder).build(app)?;
    // Converting a Word/PDF/HTML file has been possible for versions, but only
    // by opening one — there was no entry point that said "import", which is
    // the word people look for.
    let import_docs = accel!(
        MenuItemBuilder::with_id("file.import", s.import_docs),
        "file.import",
        "CmdOrCtrl+Shift+L"
    )
    .build(app)?;
    let save = accel!(MenuItemBuilder::with_id("file.save", s.save), "file.save", "CmdOrCtrl+S")
        .build(app)?;
    let save_as = accel!(MenuItemBuilder::with_id("file.saveAs", s.save_as), "file.saveAs", "CmdOrCtrl+Shift+S")
        .build(app)?;
    let print_item = accel!(MenuItemBuilder::with_id("file.print", s.print_item), "file.print", "CmdOrCtrl+P")
        .build(app)?;
    let close_tab = accel!(MenuItemBuilder::with_id("file.closeTab", s.close_tab), "file.closeTab", "CmdOrCtrl+W")
        .build(app)?;
    let new_window = accel!(MenuItemBuilder::with_id("window.new", s.new_window), "window.new", "CmdOrCtrl+Shift+N")
        .build(app)?;
    let open_external = accel!(MenuItemBuilder::with_id("file.openExternal", s.open_external), "file.openExternal", "CmdOrCtrl+Shift+E")
        .build(app)?;
    // Linux tiling WM has no window X button — needs discoverable Exit in native menu (Ctrl+Q).
    #[cfg(target_os = "linux")]
    let exit_item =
        accel!(MenuItemBuilder::with_id("file.exit", s.exit), "file.exit", "Ctrl+Q").build(app)?;

    #[cfg(target_os = "linux")]
    let file_submenu = SubmenuBuilder::new(app, s.file)
        .item(&new_md)
        .item(&new_txt)
        .separator()
        .item(&open_file)
        .item(&open_folder)
        .item(&import_docs)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&open_external)
        .separator()
        .item(&print_item)
        .separator()
        .item(&new_window)
        .item(&close_tab)
        .separator()
        .item(&exit_item)
        .build()?;
    #[cfg(not(target_os = "linux"))]
    let file_submenu = SubmenuBuilder::new(app, s.file)
        .item(&new_md)
        .item(&new_txt)
        .separator()
        .item(&open_file)
        .item(&open_folder)
        .item(&import_docs)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&open_external)
        .separator()
        .item(&print_item)
        .separator()
        .item(&new_window)
        .item(&close_tab)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, s.edit)
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let toggle_theme = MenuItemBuilder::with_id("view.toggleTheme", s.toggle_theme).build(app)?;
    let toggle_sidebar = accel!(MenuItemBuilder::with_id("view.toggleFileTree", s.toggle_sidebar), "view.toggleFileTree", "CmdOrCtrl+B")
        .build(app)?;
    let toggle_outline = accel!(MenuItemBuilder::with_id("view.toggleOutline", s.toggle_outline), "view.toggleOutline", "CmdOrCtrl+Shift+O")
        .build(app)?;
    let cycle_view = accel!(MenuItemBuilder::with_id("view.cycleView", s.cycle_view), "view.cycleView", "CmdOrCtrl+Shift+P")
        .build(app)?;
    // v4.3.0 PR #74 — three independent zoom axes wired through native
    // menu accelerators (more reliable than JS keyboard handlers on macOS,
    // which the WKWebView can sometimes intercept). Action ids are
    // dispatched in App.vue's `dispatchMenuAction`.
    let ui_zoom_in = accel!(MenuItemBuilder::with_id("view.zoomUiIn", s.ui_zoom_in), "view.zoomUiIn", "CmdOrCtrl+=")
        .build(app)?;
    let ui_zoom_out = accel!(MenuItemBuilder::with_id("view.zoomUiOut", s.ui_zoom_out), "view.zoomUiOut", "CmdOrCtrl+-")
        .build(app)?;
    let ui_zoom_reset = accel!(MenuItemBuilder::with_id("view.zoomUiReset", s.ui_zoom_reset), "view.zoomUiReset", "CmdOrCtrl+0")
        .build(app)?;
    let editor_zoom_in = accel!(MenuItemBuilder::with_id("view.zoomEditorIn", s.editor_zoom_in), "view.zoomEditorIn", "CmdOrCtrl+Shift+=")
        .build(app)?;
    let editor_zoom_out = accel!(MenuItemBuilder::with_id("view.zoomEditorOut", s.editor_zoom_out), "view.zoomEditorOut", "CmdOrCtrl+Shift+-")
        .build(app)?;
    let editor_zoom_reset = accel!(MenuItemBuilder::with_id("view.zoomEditorReset", s.editor_zoom_reset), "view.zoomEditorReset", "CmdOrCtrl+Shift+0")
        .build(app)?;
    let preview_zoom_in = accel!(MenuItemBuilder::with_id("view.zoomPreviewIn", s.preview_zoom_in), "view.zoomPreviewIn", "CmdOrCtrl+Control+=")
        .build(app)?;
    let preview_zoom_out = accel!(MenuItemBuilder::with_id("view.zoomPreviewOut", s.preview_zoom_out), "view.zoomPreviewOut", "CmdOrCtrl+Control+-")
        .build(app)?;
    let preview_zoom_reset = accel!(MenuItemBuilder::with_id("view.zoomPreviewReset", s.preview_zoom_reset), "view.zoomPreviewReset", "CmdOrCtrl+Control+0")
        .build(app)?;
    let palette = accel!(MenuItemBuilder::with_id("view.cmdPalette", s.palette), "view.cmdPalette", "CmdOrCtrl+Shift+K")
        .build(app)?;
    let global_search = accel!(MenuItemBuilder::with_id("search.global", s.global_search), "search.global", "CmdOrCtrl+Shift+F")
        .build(app)?;
    let settings_item = accel!(MenuItemBuilder::with_id("view.settings", s.settings_menu), "view.settings", "CmdOrCtrl+,")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, s.view)
        .item(&toggle_theme)
        .separator()
        .item(&toggle_sidebar)
        .item(&toggle_outline)
        .item(&cycle_view)
        .separator()
        .item(&ui_zoom_in)
        .item(&ui_zoom_out)
        .item(&ui_zoom_reset)
        .separator()
        .item(&editor_zoom_in)
        .item(&editor_zoom_out)
        .item(&editor_zoom_reset)
        .separator()
        .item(&preview_zoom_in)
        .item(&preview_zoom_out)
        .item(&preview_zoom_reset)
        .separator()
        .item(&palette)
        .item(&global_search)
        .separator()
        .item(&settings_item)
        .build()?;

    let md_help = accel!(MenuItemBuilder::with_id("help.markdown", s.md_help), "help.markdown", "F1")
        .build(app)?;
    let about = MenuItemBuilder::with_id("help.about", s.about).build(app)?;

    let help_submenu = SubmenuBuilder::new(app, s.help)
        .item(&md_help)
        .separator()
        .item(&about)
        .build()?;

    // macOS: the first submenu becomes the "App menu" (titled with the
    // app's process name) and is where users go for About / Settings /
    // Quit by HIG convention. Without this, ⌘Q does nothing and the
    // last menu item visually becomes "Close Tab" (issue #31).
    #[cfg(target_os = "macos")]
    {
        let app_about_meta = AboutMetadata {
            name: Some("SoloMD".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            credits: Some("Made by Zhitong / xiangdong li".into()),
            authors: Some(vec!["xiangdong li".into()]),
            comments: Some("Lightweight, cross-platform Markdown editor.".into()),
            website: Some("https://solomd.app".into()),
            website_label: Some("solomd.app".into()),
            ..Default::default()
        };
        let app_submenu = SubmenuBuilder::new(app, "SoloMD")
            .about(Some(app_about_meta))
            .separator()
            .item(&settings_item)
            .separator()
            .item(&PredefinedMenuItem::services(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;

        let window_submenu = SubmenuBuilder::new(app, "Window")
            .item(&PredefinedMenuItem::minimize(app, None)?)
            .item(&PredefinedMenuItem::maximize(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::close_window(app, None)?)
            .build()?;

        return MenuBuilder::new(app)
            .items(&[
                &app_submenu,
                &file_submenu,
                &edit_submenu,
                &view_submenu,
                &window_submenu,
                &help_submenu,
            ])
            .build();
    }

    #[cfg(not(target_os = "macos"))]
    MenuBuilder::new(app)
        .items(&[&file_submenu, &edit_submenu, &view_submenu, &help_submenu])
        .build()
}

/// Frontend calls this when user changes language in Settings.
/// Windows has no native menu bar (frameless unified title bar — the in-app
/// menu re-renders reactively from the i18n store), so it's a no-op there.
#[tauri::command]
pub(super) fn set_menu_language(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    set_menu_config(app, lang, std::collections::HashMap::new())
}

/// #180 — rebuild the native menu with the user's shortcut overrides applied.
/// `accels` maps a menu item id to a Tauri accelerator string, or to an empty
/// string to strip the accelerator entirely (the action moved to a chord the
/// webview owns, or the user unbound it).
#[tauri::command]
pub(super) fn set_menu_config(
    app: tauri::AppHandle,
    lang: String,
    accels: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let menu = build_app_menu(&app, &lang, &accels).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    let _ = (app, lang, accels);
    Ok(())
}
