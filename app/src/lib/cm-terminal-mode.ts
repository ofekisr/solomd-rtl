import type { StreamParser, StringStream } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';

import { CONTINUATION_RE, PROMPT_HEAD_RE } from './terminal-block.ts';

/**
 * The code editor's half of ```terminal fences (terminal-block.ts is the
 * preview's half). Same rules, same regexes: a prompt line is a command and
 * gets shell colours, a `\` carries the command onto the next line, anything
 * else is output and stays plain.
 */
interface ShellState {
  tokens: unknown[];
}

interface TerminalState {
  isCommand: boolean;
  isContinuing: boolean;
  shellState: ShellState;
}

const freshShellState = (): ShellState => ({ tokens: [] });

function startLine(stream: StringStream, state: TerminalState): string | null {
  if (state.isContinuing) {
    state.isCommand = true;
  } else if (stream.match(PROMPT_HEAD_RE)) {
    state.isCommand = true;
    state.shellState = freshShellState();
    state.isContinuing = CONTINUATION_RE.test(stream.string);
    return 'meta';
  } else {
    state.isCommand = false;
  }
  state.isContinuing = state.isCommand && CONTINUATION_RE.test(stream.string);
  return null;
}

export const terminalSession: StreamParser<TerminalState> = {
  name: 'terminal',
  startState: () => ({ isCommand: false, isContinuing: false, shellState: freshShellState() }),
  copyState: (state) => ({ ...state, shellState: { tokens: [...state.shellState.tokens] } }),
  token(stream, state) {
    if (stream.sol()) {
      const style = startLine(stream, state);
      if (style) return style;
    }
    if (!state.isCommand) {
      stream.skipToEnd();
      return null;
    }
    return shell.token(stream, state.shellState);
  },
};
