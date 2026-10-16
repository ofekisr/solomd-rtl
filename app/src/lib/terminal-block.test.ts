import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTerminalSession, renderTerminalBlock, terminalCommands, isTerminalLang } from './terminal-block.ts';

const SESSION = '$ ls\na.txt  b.txt\n% echo hi\nhi\n';

test('recognises the terminal fence names', () => {
  assert.ok(isTerminalLang('terminal'));
  assert.ok(isTerminalLang('Console'));
  assert.ok(isTerminalLang('shell-session'));
  assert.equal(isTerminalLang('bash'), false);
});

test('splits commands from output', () => {
  assert.deepEqual(parseTerminalSession(SESSION), [
    { kind: 'command', prompt: '$ ', text: 'ls' },
    { kind: 'output', text: 'a.txt  b.txt' },
    { kind: 'command', prompt: '% ', text: 'echo hi' },
    { kind: 'output', text: 'hi' },
  ]);
});

test('recognises user@host, root, PowerShell and fancy prompts', () => {
  const kinds = parseTerminalSession('ofek@mac:~/repo$ git status\n# whoami\nPS C:\\> dir\n❯ pnpm test\n$').map((l) =>
    l.kind === 'command' ? l.prompt : l.kind,
  );
  assert.deepEqual(kinds, ['ofek@mac:~/repo$ ', '# ', 'PS C:\\> ', '❯ ', '$']);
});

test('a $ inside output is not a prompt', () => {
  assert.equal(parseTerminalSession('cost: $5')[0].kind, 'output');
  assert.equal(parseTerminalSession('$HOME is set')[0].kind, 'output');
});

test('a trailing backslash continues the command', () => {
  const lines = parseTerminalSession('$ docker run \\\n  -it ubuntu \\\n  bash\nhello');
  assert.deepEqual(lines.map((l) => l.kind), ['command', 'continuation', 'continuation', 'output']);
});

test('copy text is the commands only', () => {
  assert.equal(terminalCommands(SESSION), 'ls\necho hi');
  assert.equal(terminalCommands('$ a \\\n  b\nout'), 'a \\\n  b');
});

test('renders a window with title, prompt, highlighted command and escaped output', () => {
  const html = renderTerminalBlock('$ echo "<b>"\n<b>\n', {
    title: 'deploy',
    highlight: (c) => `<em>${c.length}</em>`,
    attrs: ' data-source-line="3"',
  });
  assert.match(html, /^<div class="terminal-block" data-source-line="3">/);
  assert.match(html, /<span class="terminal-title">deploy<\/span>/);
  assert.match(html, /<span class="term-prompt" aria-hidden="true">\$ <\/span><span class="term-input"><em>10<\/em><\/span>/);
  assert.match(html, /<span class="term-line term-out">&lt;b&gt;<\/span>/);
});

test('defaults the title and escapes it', () => {
  assert.match(renderTerminalBlock('$ x'), /terminal-title">Terminal</);
  assert.match(renderTerminalBlock('$ x', { title: '<i>' }), /terminal-title">&lt;i&gt;</);
});
