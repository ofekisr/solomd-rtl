<script setup lang="ts">
import { computed } from 'vue';
import type { WireCommit } from '../../lib/git-pane/shared/models';
import type { GraphEdge, GraphNode } from '../../lib/git-pane/graph/computeGraphLayout';
import { graphEdgePath } from '../../lib/git-pane/graph/graphEdgePath';

const DOT_RADIUS = 4;
const EDGE_WIDTH = 2;
const MERGE_CORNER_PX = 9;
const LANE_CORNER_PX = 6;
const CORNER_LANE_RATIO = 0.35;

const props = defineProps<{
  commit: WireCommit;
  node: GraphNode | undefined;
  edgesAbove: GraphEdge[];
  edgesBelow: GraphEdge[];
  laneCount: number;
  rowHeight: number;
  laneWidth: number;
  isSelected: boolean;
}>();
defineEmits<{ (e: 'select'): void; (e: 'context', ev: MouseEvent): void }>();

const graphWidth = computed(() => Math.max(1, props.laneCount) * props.laneWidth);
const date = computed(() => new Date(props.commit.date).toLocaleString());
const x = (lane: number): number => lane * props.laneWidth + props.laneWidth / 2;

function path(edge: GraphEdge, y1: number, y2: number): string {
  const corner = Math.min(edge.kind === 'merge' ? MERGE_CORNER_PX : LANE_CORNER_PX, props.laneWidth * CORNER_LANE_RATIO);
  return graphEdgePath(x(edge.fromLane), y1, x(edge.toLane), y2, corner, edge.kind);
}
</script>

<template>
  <div
    class="git-graph-row"
    :class="{ 'git-graph-row--selected': isSelected }"
    :style="{ blockSize: `${rowHeight}px` }"
    @click="$emit('select')"
    @contextmenu.prevent="$emit('context', $event)"
  >
    <svg :width="graphWidth" :height="rowHeight" dir="ltr" class="git-graph-row__svg">
      <path v-for="(e, i) in edgesAbove" :key="`a${i}`" :d="path(e, -rowHeight / 2, rowHeight / 2)" :stroke="e.color" fill="none" :stroke-width="EDGE_WIDTH" />
      <path v-for="(e, i) in edgesBelow" :key="`b${i}`" :d="path(e, rowHeight / 2, rowHeight * 1.5)" :stroke="e.color" fill="none" :stroke-width="EDGE_WIDTH" />
      <circle v-if="node" :cx="x(node.lane)" :cy="rowHeight / 2" :r="DOT_RADIUS" :fill="node.color" />
    </svg>
    <span class="git-graph-row__subject" dir="auto">{{ commit.subject }}</span>
    <span v-for="r in commit.refs" :key="r.type + r.name" class="git-ref-chip" :data-type="r.type" dir="auto">{{ r.label }}</span>
    <span class="git-graph-row__author" dir="auto">{{ commit.author.name }}</span>
    <span class="git-graph-row__date" dir="ltr">{{ date }}</span>
  </div>
</template>
