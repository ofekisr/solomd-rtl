<script setup lang="ts">
/**
 * IntegrationsSettings — v2.4 Settings → Integrations panel.
 *
 * Two cards:
 *   1. CLI (solomd)        — `which solomd` status + install one-liner
 *   2. MCP (solomd-mcp)    — bundled sidecar path + Claude Desktop config
 *
 * Designed to be embedded inline inside SettingsPanel.vue right under the
 * AI rewrite section (so users see CLI + MCP + AI as a related cluster of
 * "things SoloMD talks to").
 */

import { ref, computed, onMounted } from 'vue';
import { aiToolsPort, clipboardPort, openerPort } from '../platform/index.ts';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { useI18n } from '../i18n';
import McpProfilesSettings from './McpProfilesSettings.vue';

const { t } = useI18n();
const toasts = useToastsStore();
const workspace = useWorkspaceStore();

// One-liner the user pastes in their terminal. Mirrors scripts/install-cli.sh.
const CLI_INSTALL_CMD =
  'curl -fsSL https://raw.githubusercontent.com/zhitongblog/solomd/main/scripts/install-cli.sh | bash';

const MCP_DOCS_URL = computed(() => 'https://solomd.app/docs/mcp/');
const CLI_DOCS_URL = computed(() => 'https://solomd.app/docs/cli/');

// ---------------------------------------------------------------------------
// Backend state
// ---------------------------------------------------------------------------

interface CliStatus {
  installed: boolean;
  path?: string | null;
  version?: string | null;
}

interface McpPath {
  path: string | null;
  bundled: boolean;
}

const cli = ref<CliStatus>({ installed: false });
const mcp = ref<McpPath>({ path: null, bundled: false });
const claudeConfigPath = ref<string | null>(null);

async function refreshAll() {
  try {
    cli.value = await aiToolsPort.cliStatus();
  } catch (e) {
    cli.value = { installed: false };
  }
  try {
    mcp.value = await aiToolsPort.mcpPath();
  } catch (e) {
    mcp.value = { path: null, bundled: false };
  }
  try {
    claudeConfigPath.value = await aiToolsPort.mcpClaudeDesktopConfigPath();
  } catch {
    claudeConfigPath.value = null;
  }
}

onMounted(refreshAll);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function copyInstallCmd() {
  await clipboardPort.writeText(CLI_INSTALL_CMD);
  toasts.success(t('integrations.cliCopiedToast'));
}

async function showInstall() {
  // We don't run sudo from the GUI. Toast the command + copy it for them.
  await clipboardPort.writeText(CLI_INSTALL_CMD);
  toasts.info(t('integrations.cliInstallToast') + '  ' + CLI_INSTALL_CMD);
}

// ---------------------------------------------------------------------------
// MCP — Claude Desktop config block
// ---------------------------------------------------------------------------

const claudeConfigJson = computed(() => {
  // Build the exact JSON we'd want the user to drop into their config.
  // We always emit the `solomd-vault` server key with the bundled binary
  // path + the user's currently-open workspace folder. If either is
  // missing (no workspace, dev build) we fall back to a sensible
  // placeholder + comment.
  const command = mcp.value.path ?? '/path/to/solomd-mcp';
  const ws = workspace.currentFolder ?? '/path/to/your/notes';

  const config = {
    mcpServers: {
      'solomd-vault': {
        command,
        args: ['--workspace', ws],
      },
    },
  };
  return JSON.stringify(config, null, 2);
});

async function copyMcpConfig() {
  await clipboardPort.writeText(claudeConfigJson.value);
  if (!workspace.currentFolder) {
    toasts.info(t('integrations.mcpNoWorkspace'));
  } else {
    toasts.success(t('integrations.mcpCopiedToast'));
  }
}

async function openClaudeConfigFile() {
  if (!claudeConfigPath.value) return;
  try {
    await openerPort.openPath(claudeConfigPath.value);
  } catch (e) {
    // File may not exist yet — reveal the parent folder so the user can
    // create it, or fall back to surfacing the path in a toast.
    try {
      await openerPort.revealItemInDir(claudeConfigPath.value);
    } catch {
      toasts.info(claudeConfigPath.value);
    }
  }
}

async function openMcpDocs() {
  try {
    await openerPort.openUrl(MCP_DOCS_URL.value);
  } catch (e) {
    toasts.error(String(e));
  }
}

async function openCliDocs() {
  try {
    await openerPort.openUrl(CLI_DOCS_URL.value);
  } catch (e) {
    toasts.error(String(e));
  }
}

// ---------------------------------------------------------------------------
// v4.4.5 MCP auto-install — detect / inject / remove across 6 AI clients.
// ---------------------------------------------------------------------------

interface AiClient {
  id: string;
  display_name: string;
  config_path: string;
  config_exists: boolean;
  config_dir_exists: boolean;
  has_solomd_entry: boolean;
}

const clients = ref<AiClient[]>([]);
const checked = ref<Record<string, boolean>>({});
const injectAllowWrite = ref(false);
const injectBusy = ref(false);

async function refreshClients() {
  try {
    const list = await aiToolsPort.detectAiClients();
    clients.value = list;
    // Default: tick every client whose config dir already exists AND that
    // doesn't already have a solomd entry. Skips clients that aren't
    // installed (avoids creating empty config files on disk just because
    // the wizard ran) and skips ones already wired up (idempotent UX).
    const next: Record<string, boolean> = {};
    for (const c of list) {
      next[c.id] = c.config_dir_exists && !c.has_solomd_entry;
    }
    checked.value = next;
  } catch (e) {
    toasts.error(String(e));
  }
}

onMounted(refreshClients);

const injectableCount = computed(
  () => Object.values(checked.value).filter(Boolean).length,
);

async function injectChecked() {
  if (!workspace.currentFolder) {
    toasts.info(t('integrations.mcpNoWorkspace'));
    return;
  }
  injectBusy.value = true;
  try {
    const targets = clients.value.filter((c) => checked.value[c.id]);
    let okCount = 0;
    for (const c of targets) {
      try {
        await aiToolsPort.injectMcp({
          clientId: c.id,
          workspace: workspace.currentFolder,
          allowWrite: injectAllowWrite.value,
        });
        okCount += 1;
      } catch (e) {
        toasts.error(`${c.display_name}: ${e}`);
      }
    }
    if (okCount > 0) {
      toasts.success(
        t('integrations.aiClientsInjectedToast', { n: String(okCount) }),
      );
      await refreshClients();
    }
  } finally {
    injectBusy.value = false;
  }
}

async function removeOne(c: AiClient) {
  try {
    await aiToolsPort.removeMcp({ clientId: c.id });
    toasts.success(
      t('integrations.aiClientsRemovedToast', { name: c.display_name }),
    );
    await refreshClients();
  } catch (e) {
    toasts.error(String(e));
  }
}

async function openClientConfig(c: AiClient) {
  try {
    await openerPort.openPath(c.config_path);
  } catch {
    try {
      await openerPort.revealItemInDir(c.config_path);
    } catch {
      toasts.info(c.config_path);
    }
  }
}

// ---------------------------------------------------------------------------
// Static lists (kept here so the template can `v-for` over a typed array
// rather than `Object.keys(t(...))` which is awkward in Vue templates).
// ---------------------------------------------------------------------------
const cliSubKeys = ['open', 'new', 'list', 'search', 'cat', 'help'] as const;
const mcpToolKeys = [
  'list_notes',
  'read_note',
  'search',
  'get_backlinks',
  'list_tags',
  'get_outline',
  'write_note',
  'append_to_note',
] as const;
</script>

<template>
  <section class="integrations">
    <h3 class="integrations__heading">{{ t('integrations.heading') }}</h3>
    <p class="integrations__intro">{{ t('integrations.intro') }}</p>

    <!-- ────────────────────────────────────────────────────────────── -->
    <!-- CLI sub-card                                                    -->
    <!-- ────────────────────────────────────────────────────────────── -->
    <div class="ic-card" data-testid="integrations-cli">
      <div class="ic-card__title">{{ t('integrations.cliTitle') }}</div>

      <div class="ic-status">
        <span
          class="ic-dot"
          :class="cli.installed ? 'ic-dot--ok' : 'ic-dot--off'"
        ></span>
        <span v-if="cli.installed">
          {{ t('integrations.cliInstalled', { path: cli.path || '' }) }}
        </span>
        <span v-else class="ic-status--off">
          {{ t('integrations.cliNotInstalled') }}
        </span>
      </div>
      <div v-if="cli.version" class="ic-version">
        {{ t('integrations.cliVersionLabel') }}: {{ cli.version }}
      </div>

      <div class="ic-row">
        <button class="ic-btn" @click="showInstall">
          {{ t('integrations.cliInstallBtn') }}
        </button>
        <button class="ic-btn" @click="copyInstallCmd">
          {{ t('integrations.cliCopyInstallBtn') }}
        </button>
        <button class="ic-btn" @click="openCliDocs">
          {{ t('integrations.cliDocsBtn') }}
        </button>
      </div>

      <details class="ic-details">
        <summary>{{ t('integrations.cliSubcommandsHeading') }}</summary>
        <ul class="ic-list">
          <li v-for="k in cliSubKeys" :key="k">
            <code>solomd {{ k }}</code> —
            {{ t(`integrations.cliSubcommands.${k}`) }}
          </li>
        </ul>
      </details>
    </div>

    <!-- ────────────────────────────────────────────────────────────── -->
    <!-- MCP sub-card                                                    -->
    <!-- ────────────────────────────────────────────────────────────── -->
    <div class="ic-card" data-testid="integrations-mcp">
      <div class="ic-card__title">{{ t('integrations.mcpTitle') }}</div>

      <div class="ic-status">
        <span
          class="ic-dot"
          :class="mcp.bundled ? 'ic-dot--ok' : 'ic-dot--off'"
        ></span>
        <span v-if="mcp.bundled">
          {{ t('integrations.mcpBundled', { path: mcp.path || '' }) }}
        </span>
        <span v-else class="ic-status--off">
          {{ t('integrations.mcpNotBundled') }}
        </span>
      </div>
      <p class="ic-desc">{{ t('integrations.mcpDesc') }}</p>

      <div class="ic-config-heading">
        {{ t('integrations.mcpClaudeConfigHeading') }}
      </div>
      <p class="ic-config-hint">{{ t('integrations.mcpClaudeConfigHint') }}</p>

      <pre
        class="ic-config-block"
        @click="copyMcpConfig"
        :title="t('integrations.mcpCopyConfigBtn')"
      >{{ claudeConfigJson }}</pre>

      <div class="ic-row">
        <button class="ic-btn" @click="copyMcpConfig">
          {{ t('integrations.mcpCopyConfigBtn') }}
        </button>
        <button
          class="ic-btn"
          :disabled="!claudeConfigPath"
          @click="openClaudeConfigFile"
        >
          {{ t('integrations.mcpOpenConfigBtn') }}
        </button>
        <button class="ic-btn" @click="openMcpDocs">
          {{ t('integrations.mcpHowBtn') }}
        </button>
      </div>

      <details class="ic-details">
        <summary>{{ t('integrations.mcpToolsHeading') }}</summary>
        <ul class="ic-list">
          <li v-for="k in mcpToolKeys" :key="k">
            <code>{{ k }}</code> —
            {{ t(`integrations.mcpTools.${k}`) }}
          </li>
        </ul>
        <p class="ic-write-note">
          {{ t('integrations.mcpWriteNote') }}
        </p>
      </details>

      <!-- v4.0 P4 federation: named bundles of workspaces, each with a -->
      <!-- one-click "Copy Claude Desktop config" button.                -->
      <McpProfilesSettings />
    </div>

    <!-- ────────────────────────────────────────────────────────────── -->
    <!-- v4.4.5 — AI clients auto-install                                -->
    <!-- ────────────────────────────────────────────────────────────── -->
    <div class="ic-card" data-testid="integrations-ai-clients">
      <div class="ic-card__title">{{ t('integrations.aiClientsTitle') }}</div>
      <p class="ic-intro-small">{{ t('integrations.aiClientsIntro') }}</p>

      <ul class="ai-clients">
        <li v-for="c in clients" :key="c.id" class="ai-client">
          <label class="ai-client__row">
            <input
              type="checkbox"
              v-model="checked[c.id]"
              :disabled="!c.config_dir_exists || injectBusy"
            />
            <span class="ai-client__name">{{ c.display_name }}</span>
            <span
              v-if="!c.config_dir_exists"
              class="ai-client__badge ai-client__badge--off"
            >
              {{ t('integrations.aiClientsNotInstalled') }}
            </span>
            <span
              v-else-if="c.has_solomd_entry"
              class="ai-client__badge ai-client__badge--ok"
            >
              {{ t('integrations.aiClientsAlreadyConfigured') }}
            </span>
            <span
              v-else
              class="ai-client__badge ai-client__badge--pending"
            >
              {{ t('integrations.aiClientsReady') }}
            </span>
          </label>
          <div class="ai-client__actions">
            <button class="ic-btn ic-btn--small" @click="openClientConfig(c)">
              {{ t('integrations.aiClientsOpenConfigBtn') }}
            </button>
            <button
              v-if="c.has_solomd_entry"
              class="ic-btn ic-btn--small ic-btn--danger"
              @click="removeOne(c)"
            >
              {{ t('integrations.aiClientsRemoveBtn') }}
            </button>
          </div>
          <div class="ai-client__path">{{ c.config_path }}</div>
        </li>
      </ul>

      <div class="ai-clients__controls">
        <label class="ai-clients__allow-write">
          <input type="checkbox" v-model="injectAllowWrite" />
          {{ t('integrations.aiClientsAllowWrite') }}
        </label>
        <button
          class="ic-btn ic-btn--primary"
          :disabled="injectableCount === 0 || injectBusy"
          @click="injectChecked"
        >
          {{
            injectableCount === 0
              ? t('integrations.aiClientsInjectBtnZero')
              : t('integrations.aiClientsInjectBtn', {
                  n: String(injectableCount),
                })
          }}
        </button>
      </div>

      <p class="ic-write-note">
        {{ t('integrations.aiClientsRestartHint') }}
      </p>
    </div>
  </section>
</template>

<style scoped src="./IntegrationsSettings.css"></style>
