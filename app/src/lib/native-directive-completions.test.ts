import assert from "node:assert/strict";
import test from "node:test";

import type { LoadedDirectiveCompletionManifest } from "./directive-completion-registry.ts";
import {
  applyDirectiveCompletion,
  completionContextAt,
} from "./directive-completions.ts";
import {
  applyNativeDirectiveCompletion,
  nativeDirectiveCompletion,
} from "./native-directive-completions.ts";

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
    },
    { key: "toc", type: "boolean", values: ["true", "false"], default: "true" },
  ],
};

test("native options preserve shared labels, ranges, inserts, and cursor offsets", () => {
  const text = "<!-- epub: sk";
  const native = nativeDirectiveCompletion(text, text.length, [epubManifest]);
  const shared = completionContextAt(text, text.length, [epubManifest]);

  assert.equal(native?.from, shared?.from);
  assert.equal(native?.to, shared?.to);
  assert.deepEqual(
    native?.items.map(({ label, insert, cursorOffset }) => ({
      label,
      insert,
      cursorOffset,
    })),
    shared?.options.map(({ label, insertText, cursorOffset }) => ({
      label,
      insert: insertText,
      cursorOffset,
    })),
  );
  assert.equal(native?.items[0]?.hint, "Skip section");
});

test("flat and live insertion use the same multiline snippet result", () => {
  const text = "epub-dir";
  const completion = nativeDirectiveCompletion(text, text.length, [
    epubManifest,
  ])!;
  const index = completion.items.findIndex(
    ({ label }) => label === "epub-directives",
  );

  assert.deepEqual(
    applyNativeDirectiveCompletion(text, completion, index),
    applyDirectiveCompletion(
      text,
      completion.sharedContext,
      completion.sharedContext.options[index]!,
    ),
  );
});

test("empty manifests and fences return no native completion", () => {
  assert.equal(nativeDirectiveCompletion("<!-- epub: s", 12, []), null);
  const fenced = "```\n<!-- epub: s";
  assert.equal(
    nativeDirectiveCompletion(fenced, fenced.length, [epubManifest]),
    null,
  );
});

test("arbitrary grammar and partial values use the shared engine", () => {
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
  const text = "[* x+ skip::t";
  const completion = nativeDirectiveCompletion(text, text.length, [arbitrary]);

  assert.deepEqual(
    completion?.items.map(({ label }) => label),
    ["false", "true"],
  );
});
