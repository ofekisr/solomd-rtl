<!-- In-document find / replace (Ctrl+F). The textarea path has no CodeMirror search panel. -->
<script setup lang="ts">
import { useI18n } from '../../../i18n';
import type { PlainApi } from '../internal/plain/plain-api.ts';

const props = defineProps<{ engine: PlainApi }>();
const { t } = useI18n();
const {
  closePlainFind,
  gotoPlainMatch,
  onPlainFindEnter,
  onPlainFindInput,
  plainFindBar,
  plainFindCaseSensitive,
  plainFindDodge,
  plainFindInput,
  plainFindOpen,
  plainFindQuery,
  plainMatchIndex,
  plainMatches,
  plainReplaceValue,
  replacePlainAll,
  replacePlainCurrent,
  revealPlainMatchFromAnchor,
} = props.engine;
</script>

<template>
  <div
    v-if="plainFindOpen"
    ref="plainFindBar"
    class="plain-find"
    :class="{ 'plain-find--dodge': plainFindDodge }"
    @keydown.esc.prevent.stop="closePlainFind(true)"
  >
    <div class="plain-find__row">
      <!-- Enter / Shift+Enter step through matches and keep focus here;
           Esc hands the editor the current match (#330). -->
      <input
        ref="plainFindInput"
        class="plain-find__input"
        :value="plainFindQuery"
        :placeholder="t('plainFind.findPlaceholder')"
        @input="(e) => onPlainFindInput((e.target as HTMLInputElement).value, (e as InputEvent).isComposing)"
        @compositionend="(e) => onPlainFindInput((e.target as HTMLInputElement).value)"
        @keydown.enter="onPlainFindEnter"
      />
      <span class="plain-find__count">{{ plainMatches.length ? (plainMatchIndex + 1) + '/' + plainMatches.length : '0/0' }}</span>
      <button class="plain-find__btn" :title="t('plainFind.prev')" @click="gotoPlainMatch(-1)">‹</button>
      <button class="plain-find__btn" :title="t('plainFind.next')" @click="gotoPlainMatch(1)">›</button>
      <button
        class="plain-find__btn"
        :class="{ 'plain-find__btn--on': plainFindCaseSensitive }"
        :title="t('plainFind.matchCase')"
        @click="plainFindCaseSensitive = !plainFindCaseSensitive; revealPlainMatchFromAnchor()"
      >Aa</button>
      <button class="plain-find__btn" :title="t('plainFind.close')" @click="closePlainFind(true)">✕</button>
    </div>
    <div class="plain-find__row">
      <input
        class="plain-find__input"
        :value="plainReplaceValue"
        :placeholder="t('plainFind.replacePlaceholder')"
        @input="(e) => plainReplaceValue = (e.target as HTMLInputElement).value"
        @keydown.enter="(e) => { if (!e.isComposing && e.keyCode !== 229) { e.preventDefault(); replacePlainCurrent(); } }"
      />
      <button class="plain-find__btn plain-find__btn--text" @click="replacePlainCurrent">{{ t('plainFind.replaceOne') }}</button>
      <button class="plain-find__btn plain-find__btn--text" @click="replacePlainAll">{{ t('plainFind.replaceAll') }}</button>
    </div>
  </div>
</template>

<style scoped src="./plain-find-bar.css"></style>
