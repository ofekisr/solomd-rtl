# Settings IA: Theme Studio tab + two-level navigation

Date: 2026-10-29 · Status: approved (Q1 = Studio leaves the modal)

## Problem

- Settings modal (`app/src/components/SettingsPanel.vue`, 2627 lines) has 9 flat categories. Basics holds 39 sections, Writing 34, Advanced 18.
- The Theme category embeds Theme Studio and widens the modal 820 → 1280px. Layout jumps; Escape/backdrop can drop an unsaved draft.
- Bug: `VALID_CATEGORIES` (line 273) omits `keys`, so deep links to Keys fail.

## Decisions

| # | Decision |
| --- | --- |
| D1 | Theme Studio opens as a **virtual editor tab** (like the git-diff tab), not inside Settings and not a native window. |
| D2 | Settings keeps an **Appearance** page (category id `theme`, label "Appearance"): light/dark/system, light/dark slot pickers, "Customize in Theme Studio" button, Import theme, Marketplace. |
| D3 | The modal is **fixed size** `min(960px, 92vw) × min(720px, 85vh)`. No widening, no drag/resize, no expand toggle. |
| D4 | **Two-level nav**: a sidebar tree; one category expanded at a time; categories with one page are leaves. |
| D5 | **No back button.** Page header shows a breadcrumb `Writing › Image upload`. |
| D6 | **Search box sticky** at the top; ⌘F focuses it (exists). Each search hit shows its breadcrumb; clicking the breadcrumb clears the query and opens that page. |
| D7 | Remember the last page (category + sub-page) for the app session, not the size. |
| D8 | Category ids stay unchanged (`basics`, `theme`, …) so existing deep links keep working. Only labels change: Basics → "General", Theme → "Appearance". |
| D9 | Mobile/tablet: same tab (a tab is already full-screen there). No special sheet. |
| D10 | Studio tab is never persisted across restarts, never auto-saved, never written to disk. |

## Theme Studio tab

- `Language` gains `'theme-studio'`. A singleton tab: `tabs.openThemeStudio()` focuses the existing one or creates it (`fileName: 'Theme Studio'`).
- `lib/virtual-tabs.ts` owns "this tab has no file": `isVirtualLanguage(lang)` replaces the scattered `language === 'git-diff'` guards for persistence, save, auto-save and editor display.
- `ThemeStudioTab.vue`: two columns — left the sticky live mocks (`#theme-studio-preview`, the existing Teleport target renamed), right the Studio controls, scrolling.
- `studioOpen` (drives live preview of the real app) = the tab component is mounted.
- Dirty: `tabs.isDirty(id)` for the Studio tab returns `useThemeStudio().isDirty`, so the tab bar ● and the close dialog work unchanged.
- Close with unsaved draft → existing unsaved dialog. Save → the Studio's own `save()` (registered in the composable). Discard → `resetDraft()` so the next open starts from the active theme.
- Entry points: Appearance page button (closes Settings, opens tab), command `theme.studio` ("Theme Studio") in the keybindings registry.

## Navigation model

`lib/settings-nav.ts` is the single source: categories, their pages, label keys, default page, `parsePageKey('writing/image-upload')`. Every top-level settings block in the template carries `data-cat` (kept, search groups by it) and `data-page="<cat>/<page>"`. The per-category CSS show-list is replaced by one rule generated from the active page key (`pageVisibilityCss`), which removes the "category renders blank" foot-gun. A node test reads `SettingsPanel.vue` and fails if any block lacks a valid `data-page` or its `data-cat` disagrees with it.

| Category (label) | Pages → sections (by i18n heading key, `settings.` prefix dropped) |
| --- | --- |
| General (`basics`) | **Language & zoom**: language, uiFontSize, globalZoom, showStatusBarViewModes · **Fonts**: fontFamily, codeFontFamily, fontSize · **Editor display**: wordWrap, lineNumbers, solidCursor, livePreview, alwaysShowMarkers, highlightCurrentLine, limitEditorWidth, codeBlockLineNumbers, foldingEnabled, codeBlockWrap · **Sidebar & outline**: showOutline, outlineSide, outlineMarker, showFileTree, showBacklinks, showTagsPanel, explorerFullNames, explorerDoubleClickFolders, explorerFollowActive, explorerShowHidden, distinctSplitPanes · **Preview & Markdown**: previewFitWidth, previewMaxWidth, markdownHardBreaks, smartQuotes, markdownAutoNumberHeadings, plantumlEnabled, readingByDefaultOnMobile |
| Appearance (`theme`) | single page: appearance + slots, Studio button, importTheme (moved from Advanced) |
| Writing (`writing`) | **Editing aids**: directiveCompletions, spellcheckEnabled, spellCheck, vimMode, slashCommandsEnabled · **Focus**: writingStats, focusMode, pomodoro, typewriterMode · **Attachments**: attachmentMode, assetsDirName, attachmentCustomPath · **Image upload**: imageUploaderSection … ghImageCdn · **Inbox & daily notes**: inbox.workflowSetting, dailyNotesFolder, dailyNotesFormat (moved from Advanced) |
| Mind map (`mindmap`) | single page: mindmap.settingsDefaults, mindmapControlStyle, mindmapPasteMapTarget (moved from General) |
| Sync, Integrations, Export, Keys | single page each, unchanged |
| Advanced (`advanced`) | **Startup & session**: restoreSession, startupViewMode, perWorkspaceTabs · **Files & saving**: autoSaveAfterDelay, autoSaveOnBlur, autoReloadExternalChanges, convertConflict, openFileInNewWindow, revealInFileTreeOnOpen, openLinkedFilesExternally, fileAssoc · **Updates & privacy**: autoCheckUpdate, telemetry, aiWarningAlwaysMinimized |

Sections not listed above go on the category's first page.

## Out of scope

- Two spellcheck toggles (`spellcheckEnabled` vs `spellCheck`): placed side by side on Editing aids; merging them is a follow-up.
- Translating new labels: English only (`i18n/en.ts`); other locales fall back to English.

## Acceptance

1. Opening Appearance never changes the modal size.
2. "Customize in Theme Studio" closes Settings and focuses one Theme Studio tab; a second click does not create a second tab.
3. Editing a colour shows ● on the tab; closing asks Save/Discard/Cancel; restart never restores the tab.
4. Every section in the table renders on exactly one page; search still finds every section; clicking a hit's breadcrumb opens its page.
5. Deep links `initial-section="keys"` and `"writing/image-upload"` land on the right page.
6. `pnpm --dir app build` and `pnpm --dir app test` pass.
