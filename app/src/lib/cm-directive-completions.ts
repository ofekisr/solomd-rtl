import {
  acceptCompletion,
  completionStatus,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import {
  directiveCompletionManifests,
  type LoadedDirectiveCompletionManifest,
} from "./directive-completion-registry.ts";
import {
  applyDirectiveCompletion,
  completionContextAt,
} from "./directive-completions.ts";

export function directiveCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  if (context.view?.composing) return null;
  const shared = completionContextAt(
    context.state.doc.toString(),
    context.pos,
    directiveCompletionManifests(),
  );
  if (!shared) return null;

  const options: Completion[] = shared.options.map((sharedOption) => ({
    label: sharedOption.label,
    detail: sharedOption.detail,
    info: sharedOption.info,
    type: shared.kind === "snippet" ? "snippet" : "keyword",
    apply: (view, _completion, from, to) => {
      const applied = applyDirectiveCompletion(
        view.state.doc.toString(),
        { ...shared, from, to },
        sharedOption,
      );
      view.dispatch({
        changes: { from, to, insert: sharedOption.insertText },
        selection: { anchor: applied.caret },
      });
    },
  }));
  return {
    from: shared.from,
    to: shared.to,
    options,
    filter: false,
  };
}

export function shouldStartDirectiveCompletion(
  text: string,
  caret: number,
  manifests: readonly LoadedDirectiveCompletionManifest[],
): boolean {
  const context = completionContextAt(text, caret, manifests);
  if (!context) return false;
  const beforeCaret = text.slice(0, caret);
  if (context.kind === "snippet") {
    return beforeCaret.trimEnd().endsWith("-");
  }
  if (context.kind === "value") {
    return manifests.some(({ grammar }) =>
      beforeCaret.endsWith(grammar.keyValueSeparator),
    );
  }
  return (
    /\s$/u.test(beforeCaret) ||
    manifests.some(({ grammar }) => beforeCaret.endsWith(grammar.pairSeparator))
  );
}

export function directiveCompletionExtension(): Extension {
  return [
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || update.view.composing) return;
      if (
        !update.transactions.some((transaction) =>
          transaction.isUserEvent("input.type"),
        )
      ) {
        return;
      }

      const view = update.view;
      requestAnimationFrame(() => {
        if (!view.dom.isConnected || view.composing) return;
        const text = view.state.doc.toString();
        const caret = view.state.selection.main.head;
        const manifests = directiveCompletionManifests();
        if (!completionContextAt(text, caret, manifests)) return;

        if (completionStatus(view.state) !== null) {
          startCompletion(view);
          return;
        }
        if (shouldStartDirectiveCompletion(text, caret, manifests)) {
          startCompletion(view);
        }
      });
    }),
    Prec.highest(
      keymap.of([
        {
          key: "Tab",
          run: (view) =>
            completionStatus(view.state) === "active"
              ? acceptCompletion(view)
              : false,
        },
      ]),
    ),
  ];
}
