<!-- Autocomplete popup (/ slash, [[ wikilink, # tag, @ citation, ``` fence language). -->
<script setup lang="ts">
import type { PlainApi } from '../internal/plain/plain-api.ts';

const props = defineProps<{ engine: PlainApi }>();
const { acIndex, acItems, acOpen, acPos, applyPlainAutocomplete } = props.engine;
</script>

<template>
  <ul
    v-if="acOpen && acItems.length"
    class="plain-ac"
    :style="{ left: acPos.left + 'px', top: acPos.top + 'px' }"
  >
    <li
      v-for="(item, i) in acItems"
      :key="i"
      class="plain-ac__item"
      :class="{ 'plain-ac__item--active': i === acIndex }"
      @mousedown.prevent="applyPlainAutocomplete(item)"
      @mouseenter="acIndex = i"
    >
      <span class="plain-ac__label">{{ item.label }}</span>
      <span v-if="item.hint" class="plain-ac__hint">{{ item.hint }}</span>
    </li>
  </ul>
</template>

<style scoped src="./plain-autocomplete.css"></style>
