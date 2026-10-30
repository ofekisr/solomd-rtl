<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import CitationPickerSettings from '../../../../components/CitationPickerSettings.vue';
import { usePdfDefaultsForm } from '../../internal/usePdfDefaultsForm.ts';
import { FONT_FAMILIES } from '../../internal/font-presets.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const fontFamilies = FONT_FAMILIES;
const { pdfMmRangeError, pdfFontSelectValue, onCustomMmChange, onSelectPdfFont } = usePdfDefaultsForm();
</script>

<template>
  <!-- v2.5 F3: PDF / print export defaults. -->
  <section data-cat="export" data-page="export/main">
    <h3 style="font-size: 13px; font-weight: 600; color: var(--text); margin: 18px 0 6px;">
      {{ t('settings.pdfDefaults.heading') }}
    </h3>
    <p class="setting-hint">{{ t('settings.pdfDefaults.headingHint') }}</p>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.docxPreset') }}</label>
    <select
      :value="settings.docxPreset"
      @change="settings.setDocxPreset(($event.target as HTMLSelectElement).value as 'plain' | 'report' | 'academic')"
    >
      <option value="plain">{{ t('settings.docxPresetPlain') }}</option>
      <option value="report">{{ t('settings.docxPresetReport') }}</option>
      <option value="academic">{{ t('settings.docxPresetAcademic') }}</option>
    </select>
    <p class="setting-hint">{{ t('settings.docxPresetHint') }}</p>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.printTheme') }}</label>
    <select
      :value="settings.printTheme"
      @change="settings.setPrintTheme(($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'follow')"
    >
      <option value="light">{{ t('settings.printThemeLight') }}</option>
      <option value="dark">{{ t('settings.printThemeDark') }}</option>
      <option value="follow">{{ t('settings.printThemeFollow') }}</option>
    </select>
    <p class="setting-hint">{{ t('settings.printThemeHint') }}</p>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.pdfDefaults.pageSize') }}</label>
    <select
      :value="settings.pdfDefaults.pageSize"
      @change="settings.setPdfDefaults({ pageSize: ($event.target as HTMLSelectElement).value as any })"
    >
      <option value="A4">A4 (210 × 297 mm)</option>
      <option value="A5">A5 (148 × 210 mm)</option>
      <option value="Letter">{{ t('settings.pdfDefaults.letter') }} (8.5 × 11 in)</option>
      <option value="Legal">{{ t('settings.pdfDefaults.legal') }} (8.5 × 14 in)</option>
      <option value="Custom">{{ t('settings.pdfDefaults.custom') }}</option>
    </select>
    <div
      v-if="settings.pdfDefaults.pageSize === 'Custom'"
      class="row"
      style="gap: 6px; align-items: center; margin-top: 6px;"
    >
      <input
        type="number"
        min="50"
        max="500"
        step="1"
        :value="settings.pdfDefaults.customWidthMm"
        @input="onCustomMmChange('customWidthMm', ($event.target as HTMLInputElement).value)"
        style="width: 90px; padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px;"
        :aria-label="t('settings.pdfDefaults.widthMm')"
      />
      <span style="font-size: 12px; color: var(--text-muted);">×</span>
      <input
        type="number"
        min="50"
        max="500"
        step="1"
        :value="settings.pdfDefaults.customHeightMm"
        @input="onCustomMmChange('customHeightMm', ($event.target as HTMLInputElement).value)"
        style="width: 90px; padding: 6px 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px;"
        :aria-label="t('settings.pdfDefaults.heightMm')"
      />
      <span style="font-size: 12px; color: var(--text-muted);">mm</span>
    </div>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.pdfDefaults.margin') }}</label>
    <select
      :value="settings.pdfDefaults.margin"
      @change="settings.setPdfDefaults({ margin: ($event.target as HTMLSelectElement).value as any })"
    >
      <option value="Narrow">{{ t('settings.pdfDefaults.marginNarrow') }} (10 mm)</option>
      <option value="Normal">{{ t('settings.pdfDefaults.marginNormal') }} (15 mm)</option>
      <option value="Wide">{{ t('settings.pdfDefaults.marginWide') }} (25 mm)</option>
      <option value="Custom">{{ t('settings.pdfDefaults.custom') }}</option>
    </select>
    <div
      v-if="settings.pdfDefaults.margin === 'Custom'"
      style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-top: 6px;"
    >
      <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
        <span style="min-width: 56px; color: var(--text-muted);">{{ t('settings.pdfDefaults.marginTop') }}</span>
        <input
          type="number" min="5" max="100" step="1"
          :value="settings.pdfDefaults.customMarginTopMm"
          @input="onCustomMmChange('customMarginTopMm', ($event.target as HTMLInputElement).value)"
          style="width: 70px; padding: 4px 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px;"
        />
        <span style="font-size: 11px; color: var(--text-muted);">mm</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
        <span style="min-width: 56px; color: var(--text-muted);">{{ t('settings.pdfDefaults.marginRight') }}</span>
        <input
          type="number" min="5" max="100" step="1"
          :value="settings.pdfDefaults.customMarginRightMm"
          @input="onCustomMmChange('customMarginRightMm', ($event.target as HTMLInputElement).value)"
          style="width: 70px; padding: 4px 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px;"
        />
        <span style="font-size: 11px; color: var(--text-muted);">mm</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
        <span style="min-width: 56px; color: var(--text-muted);">{{ t('settings.pdfDefaults.marginBottom') }}</span>
        <input
          type="number" min="5" max="100" step="1"
          :value="settings.pdfDefaults.customMarginBottomMm"
          @input="onCustomMmChange('customMarginBottomMm', ($event.target as HTMLInputElement).value)"
          style="width: 70px; padding: 4px 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px;"
        />
        <span style="font-size: 11px; color: var(--text-muted);">mm</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
        <span style="min-width: 56px; color: var(--text-muted);">{{ t('settings.pdfDefaults.marginLeft') }}</span>
        <input
          type="number" min="5" max="100" step="1"
          :value="settings.pdfDefaults.customMarginLeftMm"
          @input="onCustomMmChange('customMarginLeftMm', ($event.target as HTMLInputElement).value)"
          style="width: 70px; padding: 4px 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 4px;"
        />
        <span style="font-size: 11px; color: var(--text-muted);">mm</span>
      </label>
    </div>
    <p v-if="pdfMmRangeError" class="setting-hint" style="color: var(--danger, #d12);">
      {{ t('settings.pdfDefaults.mmRangeError') }}
    </p>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.pdfDefaults.fontFamily') }}</label>
    <select
      :value="pdfFontSelectValue"
      @change="onSelectPdfFont(($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ t('settings.pdfDefaults.fontInherit') }}</option>
      <option v-for="f in fontFamilies" :key="f.label" :value="f.value">{{ f.label }}</option>
    </select>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.pdfDefaults.fontSize') }}: {{ settings.pdfDefaults.fontSize }}pt</label>
    <input
      type="range"
      min="9"
      max="16"
      step="1"
      :value="settings.pdfDefaults.fontSize"
      @input="settings.setPdfDefaults({ fontSize: +($event.target as HTMLInputElement).value })"
    />
  </section>

  <section data-cat="export" data-page="export/main">
    <label>
      <input
        type="checkbox"
        :checked="settings.pdfDefaults.footer"
        @change="settings.setPdfDefaults({ footer: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('settings.pdfDefaults.footer') }}
    </label>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>
      <input
        type="checkbox"
        :checked="settings.pdfDefaults.toc"
        @change="settings.setPdfDefaults({ toc: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('settings.pdfDefaults.toc') }}
    </label>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>{{ t('settings.pdfDefaults.codeTheme') }}</label>
    <select
      :value="settings.pdfDefaults.codeTheme"
      @change="settings.setPdfDefaults({ codeTheme: ($event.target as HTMLSelectElement).value as any })"
    >
      <option value="preview">{{ t('settings.pdfDefaults.codeThemePreview') }}</option>
      <option value="light">{{ t('settings.pdfDefaults.codeThemeLight') }}</option>
      <option value="dark">{{ t('settings.pdfDefaults.codeThemeDark') }}</option>
    </select>
    <p class="setting-hint">{{ t('settings.pdfDefaults.frontmatterHint') }}</p>
  </section>

  <section data-cat="export" data-page="export/main">
    <label>
      <input
        type="checkbox"
        :checked="settings.imageExportBranding"
        @change="settings.toggleImageExportBranding()"
      />
      {{ t('settings.imageExportBranding') }}
    </label>
    <p class="setting-hint">{{ t('settings.imageExportBrandingHint') }}</p>
  </section>

  <div data-cat="export" data-page="export/main"><CitationPickerSettings /></div>
</template>

<style scoped src="../settings-page.css"></style>
