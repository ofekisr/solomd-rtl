<script setup lang="ts">
import CommandPalette from '../CommandPalette.vue';
import QuickSwitcher from '../QuickSwitcher.vue';
import SettingsPanel from '../../features/settings/ui/SettingsPanel.vue';
import MarkdownHelp from '../MarkdownHelp.vue';
import RagSearch from '../RagSearch.vue';
import CjkProofread from '../CjkProofread.vue';
import AboutDialog from '../dialogs/AboutDialog.vue';
import AgentSetupWizard from '../ai/AgentSetupWizard.vue';
import UnsavedDialog from '../dialogs/UnsavedDialog.vue';
import FileChangedDialog from '../dialogs/FileChangedDialog.vue';
import ConvertConflictDialog from '../dialogs/ConvertConflictDialog.vue';
import ImageUrlDialog from '../dialogs/ImageUrlDialog.vue';
import SessionRestoreDialog from '../dialogs/SessionRestoreDialog.vue';
import ViewEditorDialog from '../dialogs/ViewEditorDialog.vue';
import WhiteboardOverlay from '../WhiteboardOverlay.vue';
import AIRewriteOverlay from '../ai/AIRewriteOverlay.vue';
import MindmapFenceOverlay from '../mindmap/MindmapFenceOverlay.vue';
import MindmapConvertFolder from '../mindmap/MindmapConvertFolder.vue';
import MindmapWorkbench from '../mindmap/MindmapWorkbench.vue';
import MindmapFolderTree from '../mindmap/MindmapFolderTree.vue';
import AndroidFolderPicker from '../AndroidFolderPicker.vue';
import Toast from '../Toast.vue';
import { useAppDialogs } from '../../composables/useAppDialogs';
import { useSettingsStore } from '../../stores/settings';
import { useWorkspaceStore } from '../../stores/workspace';
import { IS_APP_STORE_BUILD } from '../../lib/app-build';

/** Every app-level modal and overlay. Mounted in both editing and reading mode. */
defineProps<{
  pickAndroidFolder: (path: string) => void;
  requestAndroidStorage: () => void;
  restartAndroid: () => void;
}>();

const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const {
  paletteOpen,
  quickSwitcherOpen,
  settingsOpen,
  settingsInitialSection,
  openSettingsAt,
  helpOpen,
  ragSearchOpen,
  cjkProofreadOpen,
  aboutOpen,
  wizardOpen,
  imageUrlDialogOpen,
  onImageUrlConfirm,
  androidPickerOpen,
  androidRestartNeeded,
  unsaved,
  fileChanged,
  aiKey,
} = useAppDialogs();
const { isOpen: unsavedOpen, mode: unsavedMode, fileName: unsavedFileName, count: unsavedCount } = unsaved;
const { isOpen: fileChangedOpen, fileName: fileChangedFileName } = fileChanged;
const { hasKey: aiHasKey } = aiKey;

function onSettingsClose(): void {
  settingsOpen.value = false;
  settingsInitialSection.value = null;
  aiKey.refresh();
}

function onRagOpenSettings(section?: string): void {
  ragSearchOpen.value = false;
  openSettingsAt(section ?? 'integrations');
}
</script>

<template>
  <AIRewriteOverlay
    v-if="!IS_APP_STORE_BUILD"
    :enabled="settings.aiEnabled"
    :provider="(settings.aiProvider as any)"
    :model="settings.aiModel"
    :base-url="settings.aiBaseUrl"
    :has-key="aiHasKey"
    @open-settings="(section?: string) => openSettingsAt(section ?? 'integrations')"
  />
  <CommandPalette :open="paletteOpen" @close="paletteOpen = false" />
  <QuickSwitcher :open="quickSwitcherOpen" @close="quickSwitcherOpen = false" />
  <SettingsPanel :open="settingsOpen" :initial-section="settingsInitialSection" @close="onSettingsClose" />
  <MarkdownHelp :open="helpOpen" @close="helpOpen = false" />
  <RagSearch :open="ragSearchOpen" @close="ragSearchOpen = false" @open-settings="onRagOpenSettings" />
  <CjkProofread :open="cjkProofreadOpen" @close="cjkProofreadOpen = false" />
  <AboutDialog :open="aboutOpen" @close="aboutOpen = false" />
  <AgentSetupWizard v-if="!IS_APP_STORE_BUILD" :open="wizardOpen" @close="wizardOpen = false" />
  <UnsavedDialog
    :open="unsavedOpen"
    :mode="unsavedMode"
    :file-name="unsavedFileName"
    :count="unsavedCount"
    @save="unsaved.answer('save')"
    @discard="unsaved.answer('discard')"
    @cancel="unsaved.answer('cancel')"
  />
  <ImageUrlDialog :open="imageUrlDialogOpen" @confirm="onImageUrlConfirm" @cancel="imageUrlDialogOpen = false" />
  <SessionRestoreDialog />
  <!-- v4.6 F5 — saved-view create/edit modal (self-mounts via window events). -->
  <ViewEditorDialog />
  <WhiteboardOverlay />
  <MindmapFenceOverlay />
  <MindmapConvertFolder />
  <MindmapWorkbench />
  <MindmapFolderTree />
  <ConvertConflictDialog />
  <FileChangedDialog
    :open="fileChangedOpen"
    :file-name="fileChangedFileName"
    @reload="fileChanged.answer('reload')"
    @overwrite="fileChanged.answer('overwrite')"
    @cancel="fileChanged.answer('cancel')"
  />
  <Toast />
  <AndroidFolderPicker
    :open="androidPickerOpen"
    :start="workspace.currentFolder ?? undefined"
    @pick="pickAndroidFolder"
    @close="androidPickerOpen = false"
    @request-permission="androidPickerOpen = false; requestAndroidStorage()"
  />
  <!-- #148 (follow-up) — all-files access granted but not yet effective; a restart re-mounts shared storage. -->
  <div v-if="androidRestartNeeded" class="arn-backdrop">
    <div class="arn">
      <div class="arn__title">Restart once to read folders</div>
      <p class="arn__body">
        File access is enabled ✅. Android requires an app restart before phone storage can actually be read.<br /><br />
        Tap "Close SoloMD", swipe it away from recent apps, reopen the app, then tap "Open Folder" to pick your notes folder.
      </p>
      <div class="arn__foot">
        <button class="arn__btn" @click="androidRestartNeeded = false">Later</button>
        <button class="arn__btn arn__btn--primary" @click="restartAndroid">Close SoloMD</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arn-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-modal, 2000);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.arn {
  background: var(--bg, #fff);
  color: var(--text, #111);
  border-radius: var(--r-lg, 12px);
  width: 100%;
  max-width: 380px;
  box-shadow: var(--sh-pop, 0 8px 28px rgba(0, 0, 0, 0.12));
  padding: 18px 18px 14px;
}
.arn__title { font-weight: 600; font-size: 16px; margin-bottom: 10px; }
.arn__body { font-size: 14px; line-height: 1.6; color: var(--text-muted, #555); margin: 0 0 16px; }
.arn__foot { display: flex; gap: 10px; justify-content: flex-end; }
.arn__btn {
  border: var(--bd, 1px solid var(--border, #ddd));
  background: var(--bg-hover, #f5f5f5);
  border-radius: var(--r-sm, 6px);
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: inherit;
}
.arn__btn--primary { background: var(--accent, #ff9f40); color: #000; border-color: transparent; font-weight: 600; }
</style>
