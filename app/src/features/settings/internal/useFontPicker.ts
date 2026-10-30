import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useSettingsStore } from '../../../stores/settings';
import { CUSTOM_FONT_VALUE, FONT_FAMILIES, isPresetFont, type FontPreset } from './font-presets.ts';

export interface FontPicker {
  fontFamilies: readonly FontPreset[];
  customFontFamily: Ref<string>;
  fontFamilySelectValue: ComputedRef<string>;
  onSelectFontFamily: (value: string) => void;
  onCustomFontInput: (value: string) => void;
}

export function useFontPicker(): FontPicker {
  const settings = useSettingsStore();
  const inCustomMode = ref(!isPresetFont(settings.fontFamily));
  const customFontFamily = ref(inCustomMode.value ? settings.fontFamily : '');

  function onSelectFontFamily(value: string): void {
    if (value === CUSTOM_FONT_VALUE) {
      inCustomMode.value = true;
      return;
    }
    inCustomMode.value = false;
    customFontFamily.value = '';
    settings.setFontFamily(value);
  }

  function onCustomFontInput(value: string): void {
    customFontFamily.value = value;
    if (value.trim()) settings.setFontFamily(value.trim());
  }

  const fontFamilySelectValue = computed(() => (inCustomMode.value ? CUSTOM_FONT_VALUE : settings.fontFamily));
  return { fontFamilies: FONT_FAMILIES, customFontFamily, fontFamilySelectValue, onSelectFontFamily, onCustomFontInput };
}
