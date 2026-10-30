import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseBibFile,
  parseCslJson,
  formatInline,
  searchCitations,
  type CitationEntry,
} from './citations.ts';

const BIB = `
@comment{ignored}
@string{x = "y"}
@article{smith2020,
  author = {Smith, John and {Doe}, Jane},
  title = {A {Great}   Title},
  journal = "Nature",
  year = 2020,
  doi = {10.1/abc}
}
@book(jones99, title={Book}, publisher={Pub}, year={1999})
@misc{bare}
`;

test('parseBibFile extracts entries and skips directives', () => {
  const out = parseBibFile(BIB);
  assert.deepEqual(out.map((e) => e.key), ['smith2020', 'jones99', 'bare']);
  const a = out[0];
  assert.equal(a.type, 'article');
  assert.equal(a.author, 'Smith, John and Doe, Jane');
  assert.equal(a.title, 'A Great Title');
  assert.equal(a.journal, 'Nature');
  assert.equal(a.year, '2020');
  assert.equal(a.doi, '10.1/abc');
  assert.equal(out[1].publisher, 'Pub');
});

test('parseCslJson maps fields and tolerates bad input', () => {
  assert.deepEqual(parseCslJson('nope'), []);
  assert.deepEqual(parseCslJson('{}'), []);
  const out = parseCslJson(
    JSON.stringify([
      {
        id: 'k1',
        type: 'article-journal',
        author: [{ family: 'Smith', given: 'J' }],
        issued: { 'date-parts': [[2021]] },
        'container-title': 'Jrnl',
        DOI: 'd',
        title: 'T',
      },
      { id: 'k2', type: 'chapter', 'container-title': 'Bk', issued: { literal: 'May 2019' } },
      { type: 'x' },
    ]),
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].author, 'J Smith');
  assert.equal(out[0].year, '2021');
  assert.equal(out[0].journal, 'Jrnl');
  assert.equal(out[1].booktitle, 'Bk');
  assert.equal(out[1].year, '2019');
});

test('formatInline shortens authors', () => {
  const e = (author?: string): CitationEntry => ({ key: 'k', type: 'misc', author, year: '2000' });
  assert.equal(formatInline(e('Smith, John')), '(Smith 2000)');
  assert.equal(formatInline(e('Smith, John and Jones, Al')), '(Smith & Jones 2000)');
  assert.equal(formatInline(e('A B and C D and E F')), '(B et al. 2000)');
  assert.equal(formatInline({ key: 'k', type: 'misc' }), '(k n.d.)');
});

test('searchCitations ranks key before author before title', () => {
  const entries: CitationEntry[] = [
    { key: 'zeta', type: 'misc', title: 'smith things' },
    { key: 'other', type: 'misc', author: 'Smith, J' },
    { key: 'smith1', type: 'misc' },
    { key: 'smith', type: 'misc' },
  ];
  assert.deepEqual(searchCitations(entries, 'smith').map((x) => x.key), ['smith', 'smith1', 'other', 'zeta']);
  assert.equal(searchCitations(entries, '').length, 4);
});
