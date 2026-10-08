import assert from "node:assert/strict";
import test from "node:test";

import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import {
  directiveCompletionSource,
  shouldStartDirectiveCompletion,
} from "./cm-directive-completions.ts";
import {
  installDirectiveCompletionLoadResult,
  type LoadedDirectiveCompletionManifest,
} from "./directive-completion-registry.ts";

const epubManifest: LoadedDirectiveCompletionManifest = {
  sourceFile: "epub.json",
  schemaVersion: 1,
  grammar: {
    opening: "<!--",
    marker: "epub:",
    closing: "-->",
    pairSeparator: ",",
    keyValueSeparator: "=",
  },
  directives: [
    {
      key: "skip",
      type: "boolean",
      values: ["true", "false"],
      default: "false",
      label: "Skip section",
      description: "Exclude this section.",
    },
    { key: "toc", type: "boolean", values: ["true", "false"], default: "true" },
  ],
};

test.beforeEach(() => {
  installDirectiveCompletionLoadResult({
    directory: "/tmp/completions",
    manifests: [epubManifest],
    warnings: [],
  });
});

test("maps shared key and value ranges plus descriptive fields", () => {
  const key = directiveCompletionSource(contextFor("<!-- epub: sk"));
  const value = directiveCompletionSource(contextFor("<!-- epub: skip=t"));

  assert.equal(key?.from, 11);
  assert.equal(key?.to, 13);
  assert.equal(key?.filter, false);
  assert.equal(key?.options[0]?.label, "skip");
  assert.equal(key?.options[0]?.detail, "Skip section");
  assert.equal(key?.options[0]?.info, "Exclude this section.");
  assert.equal(value?.from, 16);
  assert.equal(value?.to, 17);
  assert.deepEqual(
    value?.options.map(({ label }) => label),
    ["false", "true"],
  );
});

test("supports arbitrary grammar and unclosed comments", () => {
  const arbitrary: LoadedDirectiveCompletionManifest = {
    ...epubManifest,
    grammar: {
      opening: "[*",
      marker: "x+",
      closing: "*]",
      pairSeparator: "||",
      keyValueSeparator: "::",
    },
  };
  installDirectiveCompletionLoadResult({
    directory: "",
    manifests: [arbitrary],
    warnings: [],
  });

  assert.equal(directiveCompletionSource(contextFor("[* x+ sk"))?.from, 6);
});

test("snippet apply inserts shared text and selection", () => {
  const state = EditorState.create({ doc: "Before\nepub-sk\nAfter" });
  const result = directiveCompletionSource(
    new CompletionContext(state, 14, true),
  );
  const completion = result?.options.find(({ label }) => label === "epub-skip");
  assert.equal(typeof completion?.apply, "function");

  let dispatched: unknown;
  const view = {
    state,
    dispatch: (spec: unknown) => {
      dispatched = spec;
    },
  } as unknown as EditorView;
  if (typeof completion?.apply === "function") {
    completion.apply(view, completion, result!.from, result!.to!);
  }

  assert.deepEqual(dispatched, {
    changes: { from: 7, to: 14, insert: "<!-- epub: skip=false -->" },
    selection: { anchor: 32 },
  });
});

test("suppresses fenced, empty-registry, and composing contexts", () => {
  assert.equal(
    directiveCompletionSource(contextFor("```\n<!-- epub: s")),
    null,
  );
  installDirectiveCompletionLoadResult({
    directory: "",
    manifests: [],
    warnings: [],
  });
  assert.equal(directiveCompletionSource(contextFor("<!-- epub: s")), null);

  installDirectiveCompletionLoadResult({
    directory: "",
    manifests: [epubManifest],
    warnings: [],
  });
  const state = EditorState.create({ doc: "<!-- epub: s" });
  const composingView = { composing: true } as EditorView;
  assert.equal(
    directiveCompletionSource(
      new CompletionContext(state, state.doc.length, true, composingView),
    ),
    null,
  );
});

test("typing marker whitespace or a pair separator requests completion", () => {
  assert.equal(
    shouldStartDirectiveCompletion("<!-- epub: ", 11, [epubManifest]),
    true,
  );
  assert.equal(
    shouldStartDirectiveCompletion("<!-- epub: skip=false,", 22, [
      epubManifest,
    ]),
    true,
  );
  assert.equal(
    shouldStartDirectiveCompletion("<!-- epub: skip=", 16, [epubManifest]),
    true,
  );
  assert.equal(
    shouldStartDirectiveCompletion("ordinary text,", 14, [epubManifest]),
    false,
  );
});

function contextFor(doc: string): CompletionContext {
  const state = EditorState.create({ doc });
  return new CompletionContext(state, doc.length, true);
}
