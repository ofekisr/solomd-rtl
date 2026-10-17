import assert from 'node:assert/strict';
import { test } from 'node:test';

import { StringStream } from '@codemirror/language';

import { terminalSession } from './cm-terminal-mode.ts';

const TAB_SIZE = 2;

function styleLines(code: string): string[][] {
  const state = terminalSession.startState!(TAB_SIZE);
  return code.split('\n').map((line) => {
    const stream = new StringStream(line, TAB_SIZE, TAB_SIZE);
    const styles: string[] = [];
    while (!stream.eol()) {
      const style = terminalSession.token(stream, state);
      if (style) styles.push(style);
      stream.start = stream.pos;
    }
    return styles;
  });
}

test('a prompt line is a styled prompt followed by shell tokens', () => {
  const [line] = styleLines('$ echo "hi"');
  assert.equal(line[0], 'meta');
  assert.ok(line.includes('string'), `expected a shell string token, got ${line}`);
});

test('output lines stay plain', () => {
  assert.deepEqual(styleLines('$ ls\nREADME.md "quoted"')[1], []);
});

test('a trailing backslash carries the command onto the next line', () => {
  const lines = styleLines('$ docker run \\\n  "image"\nplain "output"');
  assert.ok(lines[1].includes('string'), 'continuation is shell');
  assert.deepEqual(lines[2], [], 'after the command ends, output is plain again');
});

test('the prompt shapes the preview accepts are prompts here too', () => {
  for (const line of ['% ls', '# whoami', '❯ pwd', 'me@box:~$ ls', 'PS C:\\> dir']) {
    assert.equal(styleLines(line)[0][0], 'meta', line);
  }
});
