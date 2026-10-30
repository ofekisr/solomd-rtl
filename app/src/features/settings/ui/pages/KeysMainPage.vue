<script setup lang="ts">
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useShortcutEditor } from '../../internal/useShortcutEditor.ts';

const { t } = useI18n();
const settings = useSettingsStore();
const {
  macKeys, recordingAction, recordError, keyQuery, keyGroups, actionLabel, actionCombos, isCustomised,
  intercepted, interceptedIds, interceptionFor, applyHotkeyCompatPreset, writerPresetOn, writerPresetKeys,
  applyWriterPreset, undoWriterPreset, startRecording, stopRecording, formatCombo,
} = useShortcutEditor();
</script>

<template>
  <section data-cat="keys" data-page="keys/main">
    <p class="setting-hint" style="margin-top:0;">{{ t('settings.keysHint') }}</p>
    <div v-if="intercepted.length" class="kb-clash">
      <p class="kb-clash__title">⚠ {{ t('settings.keysInterceptedTitle') }}</p>
      <p class="kb-clash__body">{{ t('settings.keysInterceptedBody') }}</p>
      <ul class="kb-clash__list">
        <li v-for="b in intercepted" :key="b.action.id">
          <kbd class="kb-chip">{{ formatCombo(b.combo, macKeys) }}</kbd>
          {{ actionLabel(b.action) }}
          <span class="kb-clash__source">— {{ b.source }}</span>
          <span class="kb-clash__arrow">→</span>
          <kbd class="kb-chip">{{ formatCombo(b.alternative, macKeys) }}</kbd>
        </li>
      </ul>
      <button class="kb-btn kb-btn--wide" @click="applyHotkeyCompatPreset()">
        {{ t('settings.keysApplyCompat') }}
      </button>
    </div>
    <div class="kb-clash kb-clash--neutral">
      <p class="kb-clash__title">{{ t('settings.keysWriterTitle') }}</p>
      <p class="kb-clash__body">{{ t('settings.keysWriterBody', writerPresetKeys) }}</p>
      <button v-if="!writerPresetOn" class="kb-btn kb-btn--wide" @click="applyWriterPreset()">
        {{ t('settings.keysWriterApply', writerPresetKeys) }}
      </button>
      <button v-else class="kb-btn kb-btn--wide" @click="undoWriterPreset()">
        ✓ {{ t('settings.keysWriterUndo') }}
      </button>
    </div>
    <label class="kb-hints-toggle">
      <input type="checkbox" :checked="settings.formatHints" @change="settings.toggleFormatHints()" />
      {{ t('settings.formatHints') }}
    </label>
    <input
      v-model="keyQuery"
      class="kb-search"
      type="search"
      :placeholder="t('settings.keysSearch')"
    />
    <p v-if="!keyGroups.length" class="setting-hint">{{ t('settings.keysNoMatch') }}</p>
    <div v-for="group in keyGroups" :key="group.key" class="kb-group">
      <h4 class="kb-group__title">{{ t('settings.keysCat' + group.key.charAt(0).toUpperCase() + group.key.slice(1)) }}</h4>
      <div v-for="action in group.items" :key="action.id" class="kb-row">
        <span class="kb-row__label">{{ actionLabel(action) }}</span>
        <span class="kb-row__combos">
          <template v-if="recordingAction === action.id">
            <kbd class="kb-chip kb-chip--recording">{{ t('settings.keysRecording') }}</kbd>
          </template>
          <template v-else-if="actionCombos(action).length">
            <kbd
              v-for="c in actionCombos(action)"
              :key="c"
              class="kb-chip"
              :class="{ 'kb-chip--intercepted': interceptedIds.has(action.id) }"
              :title="
                interceptedIds.has(action.id)
                  ? t('settings.keysInterceptedBy', { source: interceptionFor(action)?.source || '' })
                  : undefined
              "
            >{{ c }}<span v-if="interceptedIds.has(action.id)" class="kb-chip__warn">⚠</span></kbd>
          </template>
          <span v-else class="kb-row__unbound">{{ t('settings.keysUnbound') }}</span>
        </span>
        <span class="kb-row__actions">
          <button
            class="kb-btn"
            :disabled="recordingAction !== null && recordingAction !== action.id"
            @click="recordingAction === action.id ? stopRecording() : startRecording(action.id)"
          >{{ recordingAction === action.id ? t('settings.keysCancel') : t('settings.keysChange') }}</button>
          <button class="kb-btn" @click="settings.setKeybinding(action.id, null)">{{ t('settings.keysUnbind') }}</button>
          <button
            class="kb-btn"
            :disabled="!isCustomised(action)"
            @click="settings.setKeybinding(action.id, undefined)"
          >{{ t('settings.keysReset') }}</button>
        </span>
      </div>
    </div>
    <p v-if="recordError" class="kb-error">{{ recordError }}</p>
    <button class="kb-btn kb-btn--wide" @click="settings.resetKeybindings()">{{ t('settings.keysResetAll') }}</button>
  </section>
</template>

<style scoped src="../settings-page.css"></style>
