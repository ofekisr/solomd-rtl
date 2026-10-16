import { openUrl } from '@tauri-apps/plugin-opener';
import { googleTranslateUrl, translateTargetLanguage } from './google-translate';

export async function openInGoogleTranslate(text: string): Promise<void> {
  const url = googleTranslateUrl(text, translateTargetLanguage(navigator.language));
  if (!url) return;
  try {
    await openUrl(url);
  } catch (err) {
    console.warn('[translate] openUrl failed, falling back to window.open', err);
    window.open(url, '_blank', 'noopener');
  }
}
