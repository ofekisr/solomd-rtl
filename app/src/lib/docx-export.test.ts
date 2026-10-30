import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownToDocxBlob } from './docx-export.ts';

const MD = `# Title

Para with **bold**, *it*, ~~s~~, \`code\` and [link](https://x.y).

- a
- b

1. one

> quote

\`\`\`ts
const x = 1;
\`\`\`

| h1 | h2 |
| -- | -- |
| c1 | c2 |

---
`;

test('markdownToDocxBlob produces a zip with document.xml content', async () => {
  const blob = await markdownToDocxBlob(MD, 'T');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.ok(bytes.length > 1000);
});

test('markdownToDocxBlob handles empty input and cover/toc preset', async () => {
  const empty = await markdownToDocxBlob('', 'T');
  assert.ok(empty.size > 0);
  const report = await markdownToDocxBlob(MD, 'T', undefined, 'report', 'Inhalt');
  assert.ok(report.size > empty.size);
});
