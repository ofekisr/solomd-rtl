import type { Component } from 'vue';
import type { PageKey } from '../../../lib/settings-nav';
import BasicsLanguagePage from './pages/BasicsLanguagePage.vue';
import BasicsFontsPage from './pages/BasicsFontsPage.vue';
import BasicsEditorPage from './pages/BasicsEditorPage.vue';
import BasicsSidebarPage from './pages/BasicsSidebarPage.vue';
import BasicsPreviewPage from './pages/BasicsPreviewPage.vue';
import ThemeMainPage from './pages/ThemeMainPage.vue';
import WritingAidsPage from './pages/WritingAidsPage.vue';
import WritingFocusPage from './pages/WritingFocusPage.vue';
import WritingAttachmentsPage from './pages/WritingAttachmentsPage.vue';
import WritingImageUploadPage from './pages/WritingImageUploadPage.vue';
import WritingInboxPage from './pages/WritingInboxPage.vue';
import MindmapMainPage from './pages/MindmapMainPage.vue';
import SyncMainPage from './pages/SyncMainPage.vue';
import IntegrationsMainPage from './pages/IntegrationsMainPage.vue';
import ExportMainPage from './pages/ExportMainPage.vue';
import KeysMainPage from './pages/KeysMainPage.vue';
import AdvancedStartupPage from './pages/AdvancedStartupPage.vue';
import AdvancedFilesPage from './pages/AdvancedFilesPage.vue';
import AdvancedUpdatesPage from './pages/AdvancedUpdatesPage.vue';

export interface SettingsPageEntry {
  key: PageKey;
  component: Component;
}

export const SETTINGS_PAGES: readonly SettingsPageEntry[] = [
  { key: 'basics/language', component: BasicsLanguagePage },
  { key: 'basics/fonts', component: BasicsFontsPage },
  { key: 'basics/editor', component: BasicsEditorPage },
  { key: 'basics/sidebar', component: BasicsSidebarPage },
  { key: 'basics/preview', component: BasicsPreviewPage },
  { key: 'theme/main', component: ThemeMainPage },
  { key: 'writing/aids', component: WritingAidsPage },
  { key: 'writing/focus', component: WritingFocusPage },
  { key: 'writing/attachments', component: WritingAttachmentsPage },
  { key: 'writing/image-upload', component: WritingImageUploadPage },
  { key: 'writing/inbox', component: WritingInboxPage },
  { key: 'mindmap/main', component: MindmapMainPage },
  { key: 'sync/main', component: SyncMainPage },
  { key: 'integrations/main', component: IntegrationsMainPage },
  { key: 'export/main', component: ExportMainPage },
  { key: 'keys/main', component: KeysMainPage },
  { key: 'advanced/startup', component: AdvancedStartupPage },
  { key: 'advanced/files', component: AdvancedFilesPage },
  { key: 'advanced/updates', component: AdvancedUpdatesPage },
];
