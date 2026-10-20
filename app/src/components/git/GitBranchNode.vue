<script setup lang="ts">
import type { BranchTreeNode } from '../../lib/git-pane/branchTree';

const INDENT_PX = 12;

defineProps<{ node: BranchTreeNode; depth: number; collapsed: Set<string> }>();
const emit = defineEmits<{
  (e: 'toggle', id: string): void;
  (e: 'select', node: BranchTreeNode): void;
  (e: 'checkout', node: BranchTreeNode): void;
  (e: 'context', node: BranchTreeNode): void;
}>();
</script>

<template>
  <div
    class="git-row"
    :style="{ paddingInlineStart: `${depth * INDENT_PX}px` }"
    :class="{ 'git-row--current': node.branch?.isCurrent }"
    @click="node.kind === 'folder' ? emit('toggle', node.id) : emit('select', node)"
    @dblclick="emit('checkout', node)"
    @contextmenu.prevent="emit('context', node)"
  >
    <span v-if="node.kind === 'folder'">{{ collapsed.has(node.id) ? '▸' : '▾' }}</span>
    <span v-else>{{ node.kind === 'tag' ? '🏷' : '⎇' }}</span>
    <span class="git-row__name" dir="auto">{{ node.label }}</span>
    <span v-if="node.branch && (node.branch.ahead || node.branch.behind)" class="git-row__dir" dir="ltr">↑{{ node.branch.ahead }} ↓{{ node.branch.behind }}</span>
  </div>
  <template v-if="node.kind === 'folder' && !collapsed.has(node.id)">
    <GitBranchNode
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :depth="depth + 1"
      :collapsed="collapsed"
      @toggle="emit('toggle', $event)"
      @select="emit('select', $event)"
      @checkout="emit('checkout', $event)"
      @context="emit('context', $event)"
    />
  </template>
</template>
