import type {
  DirectiveDefinition,
  DirectiveGrammar,
  LoadedDirectiveCompletionManifest,
} from "./directive-completion-registry";

export interface DirectiveCompletionOption {
  label: string;
  detail?: string;
  info?: string;
  insertText: string;
  cursorOffset: number;
}

export interface DirectiveCompletionContext {
  from: number;
  to: number;
  kind: "key" | "value" | "snippet";
  options: readonly DirectiveCompletionOption[];
}

interface Fence {
  character: "`" | "~";
  length: number;
}

export function completionContextAt(
  text: string,
  caret: number,
  manifests: readonly LoadedDirectiveCompletionManifest[],
): DirectiveCompletionContext | null {
  if (caret < 0 || caret > text.length) return null;
  const lineStart = caret === 0 ? 0 : text.lastIndexOf("\n", caret - 1) + 1;
  if (isInsideFence(text, lineStart)) return null;

  const lineEndIndex = text.indexOf("\n", caret);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  const snippet = snippetContext(text, lineStart, lineEnd, caret, manifests);
  if (snippet) return snippet;

  for (const manifest of manifests) {
    const matching = manifests.filter(({ grammar }) =>
      sameGrammar(grammar, manifest.grammar),
    );
    const context = directiveContext(
      text,
      lineStart,
      caret,
      manifest.grammar,
      matching.flatMap(({ directives }) => directives),
    );
    if (context) return context;
  }
  return null;
}

export function generatedDirectiveSnippets(
  manifest: LoadedDirectiveCompletionManifest,
): readonly DirectiveCompletionOption[] {
  const markerName = normalizedMarkerName(manifest.grammar.marker);
  if (!markerName) return [];
  const withDefaults = manifest.directives.filter(
    (directive): directive is DirectiveDefinition & { default: string } =>
      directive.default !== undefined,
  );
  if (withDefaults.length === 0) return [];

  const options = withDefaults.map((directive) => {
    const insertText = directiveText(manifest.grammar, [directive]);
    return option(
      `${markerName}-${directive.key}`,
      insertText,
      directive.label,
      directive.description,
    );
  });
  const insertText = `${directiveText(manifest.grammar, withDefaults)}\n\n`;
  options.push(option(`${markerName}-directives`, insertText));
  return options;
}

export function applyDirectiveCompletion(
  text: string,
  context: DirectiveCompletionContext,
  selected: DirectiveCompletionOption,
): { text: string; caret: number } {
  return {
    text: `${text.slice(0, context.from)}${selected.insertText}${text.slice(context.to)}`,
    caret: context.from + selected.cursorOffset,
  };
}

function snippetContext(
  text: string,
  lineStart: number,
  lineEnd: number,
  caret: number,
  manifests: readonly LoadedDirectiveCompletionManifest[],
): DirectiveCompletionContext | null {
  if (text.slice(caret, lineEnd).trim().length > 0) return null;
  const beforeCaret = text.slice(lineStart, caret);
  const leadingLength = whitespacePrefixLength(beforeCaret);
  const token = beforeCaret.slice(leadingLength);
  if (token.length === 0 || /\s/u.test(token)) return null;

  const options = uniqueOptions(
    manifests.flatMap((manifest) => generatedDirectiveSnippets(manifest)),
  ).filter(({ label }) => label.startsWith(token));
  if (options.length === 0) return null;
  return {
    from: lineStart + leadingLength,
    to: caret,
    kind: "snippet",
    options,
  };
}

function directiveContext(
  text: string,
  lineStart: number,
  caret: number,
  grammar: DirectiveGrammar,
  directives: readonly DirectiveDefinition[],
): DirectiveCompletionContext | null {
  const beforeCaret = text.slice(lineStart, caret);
  let offset = whitespacePrefixLength(beforeCaret);
  if (!beforeCaret.startsWith(grammar.opening, offset)) return null;
  offset += grammar.opening.length;
  offset += whitespacePrefixLength(beforeCaret.slice(offset));
  if (!beforeCaret.startsWith(grammar.marker, offset)) return null;
  offset += grammar.marker.length;
  offset += whitespacePrefixLength(beforeCaret.slice(offset));
  if (beforeCaret.indexOf(grammar.closing, offset) !== -1) return null;

  const body = beforeCaret.slice(offset);
  const currentSeparator = body.lastIndexOf(grammar.pairSeparator);
  const completedText =
    currentSeparator === -1 ? "" : body.slice(0, currentSeparator);
  if (currentSeparator !== -1 && completedText.trim().length === 0) return null;
  const currentStart =
    currentSeparator === -1
      ? 0
      : currentSeparator + grammar.pairSeparator.length;
  const usedKeys = parsedKeys(completedText, grammar);
  if (usedKeys === null) return null;

  return pairContext(
    body.slice(currentStart),
    lineStart + offset + currentStart,
    caret,
    grammar,
    directives,
    usedKeys,
  );
}

function pairContext(
  pair: string,
  absoluteStart: number,
  caret: number,
  grammar: DirectiveGrammar,
  directives: readonly DirectiveDefinition[],
  usedKeys: ReadonlySet<string>,
): DirectiveCompletionContext | null {
  const leadingLength = whitespacePrefixLength(pair);
  const content = pair.slice(leadingLength);
  const separator = grammar.keyValueSeparator;
  const separatorIndex = content.indexOf(separator);

  if (separatorIndex === -1) {
    const from = absoluteStart + leadingLength;
    const options = directives
      .filter(({ key }) => !usedKeys.has(key) && key.startsWith(content))
      .map(keyOption);
    return options.length > 0
      ? { from, to: caret, kind: "key", options }
      : null;
  }
  if (content.indexOf(separator, separatorIndex + separator.length) !== -1)
    return null;

  const key = content.slice(0, separatorIndex).trim();
  const directive = directives.find((candidate) => candidate.key === key);
  if (!directive || directive.values.length === 0) return null;
  const valueText = content.slice(separatorIndex + separator.length);
  const valueWhitespace = whitespacePrefixLength(valueText);
  const from =
    absoluteStart +
    leadingLength +
    separatorIndex +
    separator.length +
    valueWhitespace;
  return {
    from,
    to: caret,
    kind: "value",
    options: orderedValueOptions(directive),
  };
}

function parsedKeys(
  completedText: string,
  grammar: DirectiveGrammar,
): ReadonlySet<string> | null {
  const keys = new Set<string>();
  if (completedText.length === 0) return keys;
  for (const pair of splitLiteral(completedText, grammar.pairSeparator)) {
    const content = pair.trim();
    if (content.length === 0) return null;
    const first = content.indexOf(grammar.keyValueSeparator);
    const second =
      first === -1
        ? -1
        : content.indexOf(
            grammar.keyValueSeparator,
            first + grammar.keyValueSeparator.length,
          );
    if (first <= 0 || second !== -1) return null;
    const key = content.slice(0, first).trim();
    if (!key) return null;
    keys.add(key);
  }
  return keys;
}

function orderedValueOptions(
  directive: DirectiveDefinition,
): readonly DirectiveCompletionOption[] {
  const values = [...new Set(directive.values)];
  if (directive.default && values.includes(directive.default)) {
    values.splice(values.indexOf(directive.default), 1);
    values.unshift(directive.default);
  }
  return values.map((value) =>
    option(value, value, directive.label, directive.description),
  );
}

function keyOption(directive: DirectiveDefinition): DirectiveCompletionOption {
  return option(
    directive.key,
    directive.key,
    directive.label ?? directive.type,
    directive.description,
  );
}

function option(
  label: string,
  insertText: string,
  detail?: string,
  info?: string,
): DirectiveCompletionOption {
  return { label, insertText, cursorOffset: insertText.length, detail, info };
}

function directiveText(
  grammar: DirectiveGrammar,
  directives: readonly (DirectiveDefinition & { default: string })[],
): string {
  const body = directives
    .map(
      (directive) =>
        `${directive.key}${grammar.keyValueSeparator}${directive.default}`,
    )
    .join(grammar.pairSeparator);
  return `${grammar.opening} ${grammar.marker} ${body} ${grammar.closing}`;
}

function normalizedMarkerName(marker: string): string {
  return marker.trim().replace(/[^\p{L}\p{N}]+$/gu, "");
}

function uniqueOptions(
  options: readonly DirectiveCompletionOption[],
): DirectiveCompletionOption[] {
  const labels = new Set<string>();
  return options.filter(({ label }) => {
    if (labels.has(label)) return false;
    labels.add(label);
    return true;
  });
}

function splitLiteral(text: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let index = text.indexOf(separator, start);
  while (index !== -1) {
    parts.push(text.slice(start, index));
    start = index + separator.length;
    index = text.indexOf(separator, start);
  }
  parts.push(text.slice(start));
  return parts;
}

function sameGrammar(left: DirectiveGrammar, right: DirectiveGrammar): boolean {
  return (
    left.opening === right.opening &&
    left.marker === right.marker &&
    left.closing === right.closing &&
    left.pairSeparator === right.pairSeparator &&
    left.keyValueSeparator === right.keyValueSeparator
  );
}

function whitespacePrefixLength(text: string): number {
  let index = 0;
  while (index < text.length && /\s/u.test(text[index]!)) index += 1;
  return index;
}

function isInsideFence(text: string, lineStart: number): boolean {
  let fence: Fence | null = null;
  let offset = 0;
  while (offset < lineStart) {
    const lineEnd = text.indexOf("\n", offset);
    const end = lineEnd === -1 || lineEnd >= lineStart ? lineStart : lineEnd;
    const line = text.slice(offset, end);
    const run = fenceRun(line);
    if (run && fence === null) {
      fence = run;
    } else if (
      run &&
      fence &&
      run.character === fence.character &&
      run.length >= fence.length &&
      isFenceCloser(line, run)
    ) {
      fence = null;
    }
    offset = end + 1;
  }
  return fence !== null;
}

function fenceRun(line: string): Fence | null {
  let offset = 0;
  while (offset < line.length && line[offset] === " " && offset < 4)
    offset += 1;
  if (offset > 3) return null;
  const character = line[offset];
  if (character !== "`" && character !== "~") return null;
  let end = offset;
  while (line[end] === character) end += 1;
  const length = end - offset;
  return length >= 3 ? { character, length } : null;
}

function isFenceCloser(line: string, run: Fence): boolean {
  const indentation = line.length - line.trimStart().length;
  return line.slice(indentation + run.length).trim().length === 0;
}
