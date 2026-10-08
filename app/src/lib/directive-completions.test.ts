import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type {
  DirectiveDefinition,
  DirectiveGrammar,
  LoadedDirectiveCompletionManifest,
} from "./directive-completion-registry.ts";
import {
  applyDirectiveCompletion,
  completionContextAt,
  generatedDirectiveSnippets,
} from "./directive-completions.ts";

interface FixtureCase {
  name: string;
  text: string;
  caret: number;
  kind: "key" | "value" | null;
  from?: number;
  to?: number;
  labels?: string[];
}

interface Fixture {
  manifest: LoadedDirectiveCompletionManifest;
  cases: FixtureCase[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "./fixtures/directive-completions.conformance.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Fixture;
const epubManifest = fixture.manifest;

for (const fixtureCase of fixture.cases) {
  test(`conformance: ${fixtureCase.name}`, () => {
    const result = completionContextAt(fixtureCase.text, fixtureCase.caret, [
      epubManifest,
    ]);
    if (fixtureCase.kind === null) {
      assert.equal(result, null);
      return;
    }
    assert.equal(
      fixtureCase.text.slice(fixtureCase.from, fixtureCase.to),
      fixtureCase.text.slice(fixtureCase.from, fixtureCase.caret),
    );
    assert.equal(result?.kind, fixtureCase.kind);
    assert.equal(result?.from, fixtureCase.from);
    assert.equal(result?.to, fixtureCase.to);
    assert.deepEqual(
      result?.options.map(({ label }) => label),
      fixtureCase.labels,
    );
  });
}

test("unknown types still use manifest values and put a listed default first", () => {
  const manifest = withDirective({
    key: "layout",
    type: "future",
    values: ["fixed", "flow"],
    default: "flow",
  });
  const result = completionContextAt("<!-- epub: layout=", 18, [manifest]);

  assert.deepEqual(
    result?.options.map(({ label }) => label),
    ["flow", "fixed"],
  );
});

test("regex punctuation and multi-character separators are literal", () => {
  const manifest = withGrammar({
    opening: "[*",
    marker: "x+",
    closing: "*]",
    pairSeparator: "||",
    keyValueSeparator: "::",
  });
  const result = completionContextAt("[* x+ skip::t", 13, [manifest]);

  assert.equal(result?.kind, "value");
});

test("snippets contain no EPUB-specific chapter scaffold", () => {
  const options = generatedDirectiveSnippets(epubManifest);
  const all = options.find(({ label }) => label === "epub-directives");

  assert.equal(all?.insertText, "<!-- epub: skip=false,toc=true -->\n\n");
  assert.doesNotMatch(all?.insertText ?? "", /Chapter Title/);
});

test("application replaces only the reported range and uses the shared cursor offset", () => {
  const text = "Before\nepub-sk\nAfter";
  const context = completionContextAt(text, 14, [epubManifest]);
  const option = context?.options.find(({ label }) => label === "epub-skip");

  assert.deepEqual(applyDirectiveCompletion(text, context!, option!), {
    text: "Before\n<!-- epub: skip=false -->\nAfter",
    caret: 32,
  });
});

test("ordinary comments and markers after other comment text do not match", () => {
  assert.equal(completionContextAt("<!-- ordinary", 13, [epubManifest]), null);
  assert.equal(
    completionContextAt("<!-- note epub: s", 17, [epubManifest]),
    null,
  );
});

test("key completion excludes used keys and accepts empty current pair", () => {
  const result = completionContextAt("<!-- epub: skip=false, ", 22, [
    epubManifest,
  ]);

  assert.deepEqual(
    result?.options.map(({ label }) => label),
    ["toc"],
  );
});

test("malformed pairs and extra key-value separators suppress completion", () => {
  assert.equal(completionContextAt("<!-- epub: , t", 14, [epubManifest]), null);
  assert.equal(
    completionContextAt("<!-- epub: skip==t", 18, [epubManifest]),
    null,
  );
});

test("repeated values are deduplicated and directives without values do not complete", () => {
  const repeated = withDirective({
    key: "mode",
    type: "enum",
    values: ["one", "one", "two"],
  });
  const noValues = withDirective({ key: "empty", type: "text", values: [] });

  assert.deepEqual(
    completionContextAt("<!-- epub: mode=", 16, [repeated])?.options.map(
      ({ label }) => label,
    ),
    ["one", "two"],
  );
  assert.equal(completionContextAt("<!-- epub: empty=", 17, [noValues]), null);
});

test("different grammar identities may expose the same key", () => {
  const other = withGrammar({ ...epubManifest.grammar, marker: "other:" });

  assert.equal(
    completionContextAt("<!-- other: sk", 13, [epubManifest, other])?.options[0]
      ?.label,
    "skip",
  );
});

test("a longer matching fence closes but a shorter one does not", () => {
  const closed = "````\ncode\n`````\n<!-- epub: s";
  const open = "`````\ncode\n````\n<!-- epub: s";

  assert.equal(
    completionContextAt(closed, closed.length, [epubManifest])?.kind,
    "key",
  );
  assert.equal(completionContextAt(open, open.length, [epubManifest]), null);
});

test("caret before existing closing text replaces only the partial key", () => {
  const text = "<!-- epub: sk -->";
  const context = completionContextAt(text, 13, [epubManifest]);
  const option = context?.options[0];

  assert.deepEqual(applyDirectiveCompletion(text, context!, option!), {
    text: "<!-- epub: skip -->",
    caret: 15,
  });
});

function withDirective(
  directive: DirectiveDefinition,
): LoadedDirectiveCompletionManifest {
  return { ...epubManifest, directives: [directive] };
}

function withGrammar(
  grammar: DirectiveGrammar,
): LoadedDirectiveCompletionManifest {
  return { ...epubManifest, grammar };
}
