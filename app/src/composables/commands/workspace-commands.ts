import { clipboardPort, windowPort } from '../../platform/index.ts';
import { openNewWindow } from '../../lib/new-window';
import { openWelcomeTour } from '../../lib/welcome-tour';
import { useWorkspaceIndexStore } from '../../stores/workspaceIndex';
import { buildGitUrl, buildShareUrl, type NoteLocation } from './share-url.ts';
import type { Command, CommandCtx } from './command-types.ts';

export function workspaceCommands(ctx: CommandCtx): Command[] {
  const { settings, kb, tabs, toasts, daily, bases, inboxView, inbox, savedViews, auto, gh, ws, ghSync, ghSyncOps } = ctx;

  function noteLocation(): NoteLocation {
    return {
      folder: ws.currentFolder,
      filePath: tabs.activeTab?.filePath,
      remoteUrl: ghSync.status?.remote_url ?? '',
    };
  }

  return [
    {
      id: 'daily.openToday',
      title: "Open Today's Daily Note",
      shortcut: kb('daily.openToday'),
      hint: 'Create / open today\'s note in the workspace daily folder',
      run: () => daily.openTodayNote(),
    },
    {
      id: 'daily.openYesterday',
      title: "Open Yesterday's Daily Note",
      run: () => daily.openYesterday(),
    },
    {
      id: 'daily.openTomorrow',
      title: "Open Tomorrow's Daily Note",
      run: () => daily.openTomorrow(),
    },
    {
      id: 'tags.refresh',
      title: 'Refresh Tag Index',
      run: () => useWorkspaceIndexStore().rescan(),
    },
    {
      id: 'bases.open',
      title: 'Workspace: Properties Table (Bases)',
      hint: 'Browse all notes as a sortable / filterable table',
      run: () => bases.openBases(),
    },
    {
      id: 'views.toggle',
      title: 'View: Toggle Saved Views Panel',
      hint: 'Show / hide the Saved Views section in the left sidebar',
      run: () => settings.toggleViewsPanel(),
    },
    {
      id: 'views.create',
      title: 'View: Create Saved View…',
      hint: 'Define a persistent filtered note list (saved to .solomd/views/)',
      run: () => savedViews.newView(),
    },
    {
      id: 'history.initWorkspace',
      title: 'History: Initialize Git History',
      hint: 'Run `git init` + initial commit of all .md/.txt files in this workspace',
      run: async () => {
        if (!ws.currentFolder) {
          toasts.warning('Open a folder first');
          return;
        }
        try {
          await gh.init(ws.currentFolder);
          toasts.success('Git history initialized');
        } catch (e) {
          toasts.warning(`Init failed: ${e}`);
        }
      },
    },
    {
      id: 'history.commitNow',
      title: 'History: Save Snapshot Now',
      hint: 'Force an auto-commit immediately (skips the debounce window)',
      run: () => auto.commitNow(),
    },
    {
      id: 'history.toggleAutoGit',
      title: 'History: Toggle Auto-Commit on Save',
      run: () => settings.toggleAutoGit(),
    },

    // v2.6 — GitHub sync command-palette entries.
    {
      id: 'sync.pushNow',
      title: 'GitHub Sync: Push Now',
      hint: 'Push commits to the linked GitHub repo, even if auto-push is off',
      run: () => ghSyncOps.pushNow(),
    },
    {
      id: 'sync.pullNow',
      title: 'GitHub Sync: Pull Now',
      hint: 'Fetch + merge / fast-forward from the linked GitHub repo',
      run: () => ghSyncOps.pullNow(),
    },
    {
      id: 'sync.copyShareLink',
      title: 'GitHub Sync: Copy Share Link for This Note',
      hint: 'Public share via solomd.app/share — works only for public repos',
      run: async () => {
        const url = buildShareUrl(noteLocation());
        if (!url) {
          toasts.warning(
            'Open a note in a GitHub-linked workspace first, then push it.',
          );
          return;
        }
        await clipboardPort.writeText(url);
        toasts.success('Share link copied. Note must be in a public GitHub repo to render.');
      },
    },
    {
      id: 'note.copyGitUrl',
      title: 'Copy Note Git URL',
      hint: 'Copy the repository-backed URL (host/owner/repo/blob/main/path) for the active note',
      run: async () => {
        const url = buildGitUrl(noteLocation());
        if (!url) {
          toasts.warning('Open a note in a Git-linked workspace first.');
          return;
        }
        await clipboardPort.writeText(url);
        toasts.success('Git URL copied to clipboard.');
      },
    },

    {
      id: 'help.welcomeTour',
      title: 'Open Welcome Tour',
      hint: 'Open 4 in-memory tutorial tabs (Welcome, Syntax, Slideshow, Shortcuts)',
      run: () => {
        openWelcomeTour();
        toasts.success('Welcome tour opened');
      },
    },
    {
      id: 'help.markdown',
      title: 'Markdown Cheatsheet',
      shortcut: kb('help.markdown'),
      hint: 'Quick reference for Markdown syntax',
      run: () => {
        // Triggered via App-level event since useCommands has no DOM access.
        window.dispatchEvent(new CustomEvent('solomd:open-help'));
      },
    },
    {
      id: 'view.slideshow',
      title: 'Present Slideshow',
      shortcut: kb('view.slideshow'),
      hint: 'Render the active document as a fullscreen slideshow (split on `---`)',
      run: async () => {
        const t = tabs.activeTab;
        if (!t) {
          toasts.warning('No active document');
          return;
        }
        try {
          localStorage.setItem('solomd:slideshow:content', t.content || '');
          localStorage.setItem(
            'solomd:slideshow:title',
            t.fileName || 'Untitled',
          );
        } catch {}
        const label = `solomd-slideshow-${Date.now()}`;
        try {
          const win = windowPort.createWebviewWindow(label, {
            url: '/?slideshow=1',
            title: 'SoloMD — Slideshow',
            width: 1200,
            height: 800,
            decorations: true,
            resizable: true,
          });
          win.once('tauri://error', (e) => console.error('slideshow window error', e));
        } catch (e) {
          console.error('failed to open slideshow', e);
          toasts.warning('Failed to open slideshow window');
        }
      },
    },
    {
      id: 'window.new',
      title: 'New Window',
      shortcut: kb('window.new'),
      run: async () => {
        try {
          await openNewWindow();
        } catch (e) {
          console.error('failed to create window', e);
          toasts.warning('Failed to open a new window');
        }
      },
    },

    // v4.6 F6 — Inbox workflow command-palette entries.
    {
      id: 'inbox.open',
      title: 'Open Inbox',
      hint: 'Review notes flagged `inbox: true` — Week / Month / All, ⌘E to organize & advance',
      run: () => {
        if (!settings.inboxWorkflowEnabled) {
          toasts.info('Enable the Inbox workflow in Settings first');
          return;
        }
        inboxView.openInbox();
      },
    },
    {
      id: 'inbox.organizeAndAdvance',
      title: 'Inbox: Mark Organized & Advance',
      shortcut: kb('inbox.organizeAndAdvance'),
      hint: 'Set `inbox: false` on the active note and jump to the next inbox note',
      run: () => {
        if (!settings.inboxWorkflowEnabled) {
          inbox.toggleActive();
          return;
        }
        void inbox.organizeAndAdvance();
      },
    },
  ];
}
