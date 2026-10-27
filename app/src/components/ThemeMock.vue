<script setup lang="ts">
/* A miniature SoloMD window painted from one palette. Every themeable token
 * shows up somewhere in it, so a blinking token is always visible here even
 * when the real app behind Settings hides that part of the screen. */
import { computed } from 'vue';
import type { Palette } from '../lib/user-theme';

const props = defineProps<{ palette: Palette; radius: number; label: string }>();

const RADIUS_PX: Record<string, number> = { '--r-sm': 4, '--r-md': 8, '--r-lg': 12 };

const style = computed<Record<string, string>>(() => {
  const corners = Object.fromEntries(Object.entries(RADIUS_PX).map(([k, px]) => [k, `${px * props.radius}px`]));
  return { ...props.palette, ...corners };
});
</script>

<template>
  <div class="mock" :style="style" :aria-label="label">
    <div class="mock__bar">
      <span class="mock__tab mock__tab--on">notes.md</span>
      <span class="mock__tab">todo.md</span>
      <span class="mock__spacer" />
      <span class="mock__err">2 errors</span>
      <span class="mock__btn">Share</span>
    </div>
    <div class="mock__main">
      <aside class="mock__side">
        <div class="mock__file">inbox.md</div>
        <div class="mock__file mock__file--hover">ideas.md</div>
        <div class="mock__file mock__file--on">notes.md</div>
        <div class="mock__time">edited 2m ago</div>
      </aside>
      <div class="mock__editor">
        <div class="mock__find">Find… <span class="mock__placeholder">search</span></div>
        <div class="mock__lines">
          <div><i>1</i><span class="h1"># Heading 1</span></div>
          <div><i>2</i><span class="h2">## Heading 2</span> <span class="h3">### H3</span></div>
          <div><i>3</i><span class="h4">#### H4</span> <span class="h5">##### H5</span> <span class="h6">###### H6</span></div>
          <div><i>4</i>Plain <span class="strong">**bold**</span> <span class="em">*italic*</span></div>
          <div><i>5</i><span class="link">[link]</span><span class="url">(https://…)</span> <span class="code">`code`</span></div>
          <div><i>6</i><span class="quote">&gt; a quote</span></div>
          <div><i>7</i><span class="list">-</span> item <span class="hr">---</span></div>
        </div>
      </div>
      <div class="mock__preview">
        <div class="mock__ph">Heading</div>
        <p>Body text with <a>a link</a> and <code class="code">code</code>.</p>
        <pre><span class="k">const</span> <span class="v">n</span><span class="o">:</span> <span class="t">Num</span> <span class="o">=</span> <span class="n">42</span>;
<span class="f">greet</span>(<span class="s">"hi"</span>).<span class="p">len</span> <span class="c">// note</span></pre>
      </div>
    </div>
    <div class="mock__status">{{ label }} · Ln 4, Col 9 · UTF-8</div>
  </div>
</template>

<style scoped>
.mock {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  font-size: 11px;
  line-height: 1.45;
}
.mock__bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
}
.mock__tab { padding: 2px 8px; color: var(--text-muted); border-radius: var(--r-sm) var(--r-sm) 0 0; }
.mock__tab--on { background: var(--bg); color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
.mock__spacer { flex: 1; }
.mock__err { color: var(--danger); border: 1px solid var(--danger); border-radius: var(--r-sm); padding: 0 5px; }
.mock__btn { background: var(--accent); color: var(--accent-fg); border-radius: var(--r-sm); padding: 1px 8px; }
.mock__main { display: flex; min-height: 150px; }
.mock__side {
  width: 84px;
  flex-shrink: 0;
  padding: 4px;
  background: var(--bg-elev);
  border-inline-end: 1px solid var(--border);
  color: var(--text-muted);
}
.mock__file { padding: 1px 6px; border-radius: var(--r-sm); white-space: nowrap; }
.mock__file--hover { background: var(--bg-hover); }
.mock__file--on { background: var(--bg-active); color: var(--text); }
.mock__time { margin-top: 6px; padding: 0 6px; color: var(--text-faint); font-size: 10px; }
.mock__editor { flex: 1.2; min-width: 0; display: flex; flex-direction: column; }
.mock__find {
  margin: 4px;
  padding: 1px 6px;
  background: var(--bg-soft, var(--bg-elev));
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text-muted);
}
.mock__placeholder { color: var(--text-faint); }
.mock__lines { padding: 0 6px 4px 0; font-family: var(--font-mono); font-size: 10px; white-space: nowrap; overflow: hidden; }
.mock__lines i { display: inline-block; width: 18px; text-align: end; margin-inline-end: 6px; color: var(--text-faint); font-style: normal; }
.h1 { color: var(--md-h1); font-weight: 700; }
.h2 { color: var(--md-h2); font-weight: 700; }
.h3 { color: var(--md-h3); font-weight: 600; }
.h4 { color: var(--md-h4); }
.h5 { color: var(--md-h5); }
.h6 { color: var(--md-h6); }
.strong { color: var(--md-strong); font-weight: 700; }
.em { color: var(--md-em); font-style: italic; }
.link { color: var(--md-link); }
.url { color: var(--md-url); }
.code { color: var(--md-code); background: var(--md-code-bg); border-radius: var(--r-sm); padding: 0 3px; }
.quote { color: var(--md-quote); }
.list { color: var(--md-list); font-weight: 700; }
.hr { color: var(--md-hr); }
.mock__preview { flex: 1; min-width: 0; padding: 6px 8px; border-inline-start: 1px solid var(--border); }
.mock__ph { font-weight: 700; font-size: 13px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.mock__preview p { margin: 0 0 4px; }
.mock__preview a { color: var(--accent); text-decoration: underline; }
.mock__preview pre {
  margin: 0;
  padding: 4px 6px;
  background: var(--md-code-bg);
  border-radius: var(--r-md);
  font-size: 10px;
  white-space: pre-wrap;
}
.k { color: var(--syn-keyword); } .v { color: var(--syn-variable); } .o { color: var(--syn-operator); }
.t { color: var(--syn-type); } .n { color: var(--syn-number); } .f { color: var(--syn-function); }
.s { color: var(--syn-string); } .p { color: var(--syn-property); } .c { color: var(--syn-comment); font-style: italic; }
.mock__status {
  padding: 2px 8px;
  background: var(--bg-elev);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 10px;
}
@container (max-width: 420px) {
  .mock__side { display: none; }
  .mock__editor { flex: 1; }
}
</style>
