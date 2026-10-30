export interface Item {
  /** Category label, e.g. "Headings" */
  category: string;
  syntax: string;
  example: string;
  /** English description */
  en: string;
}

const C = {
  headings: 'Headings',
  emphasis: 'Emphasis',
  lists: 'Lists',
  links: 'Links & Images',
  code: 'Code',
  quotes: 'Quotes',
  tables: 'Tables',
  math: 'Math (KaTeX)',
  diagrams: 'Diagrams',
  extras: 'Extras',
  other: 'Other',
};

export const SYNTAX_ITEMS: Item[] = [
  // Headings
  {
    category: C.headings,
    syntax: '# Heading',
    example: '# H1\n## H2\n### H3',
    en: 'Headings 1–6, the number of # is the level',
  },

  // Emphasis
  {
    category: C.emphasis,
    syntax: '**bold**',
    example: '**bold text**',
    en: 'Bold text',
  },
  {
    category: C.emphasis,
    syntax: '*italic*',
    example: '*italic text*',
    en: 'Italic text',
  },
  {
    category: C.emphasis,
    syntax: '~~strike~~',
    example: '~~deleted~~',
    en: 'Strikethrough',
  },
  {
    category: C.emphasis,
    syntax: '`code`',
    example: '`inline code`',
    en: 'Inline code',
  },
  {
    category: C.emphasis,
    syntax: '==mark==',
    example: '==highlighted==',
    en: 'Highlight (GFM extension)',
  },

  // Lists
  {
    category: C.lists,
    syntax: '- item',
    example: '- Apple\n- Banana\n- Cherry',
    en: 'Unordered list (- or * works)',
  },
  {
    category: C.lists,
    syntax: '1. item',
    example: '1. First\n2. Second\n3. Third',
    en: 'Ordered list',
  },
  {
    category: C.lists,
    syntax: '- [ ] task',
    example: '- [ ] Todo\n- [x] Done',
    en: 'Task list, click checkbox to toggle',
  },
  {
    category: C.lists,
    syntax: '  - nested',
    example: '- Outer\n  - Inner\n    - Deeper',
    en: 'Indent 2 spaces to nest deeper',
  },

  // Links & images
  {
    category: C.links,
    syntax: '[text](url)',
    example: '[Google](https://google.com)',
    en: 'Link: [text](url)',
  },
  {
    category: C.links,
    syntax: '![alt](url)',
    example: '![Logo](./logo.png)',
    en: 'Image: same as link, prefixed with !',
  },
  {
    category: C.links,
    syntax: '<url>',
    example: '<https://example.com>',
    en: 'Autolink',
  },
  {
    category: C.links,
    syntax: '[text][ref]',
    example: 'See [the docs][1].\n\n[1]: https://example.com',
    en: 'Reference-style link, reuse the URL',
  },
  {
    category: C.links,
    syntax: '[[note]]',
    example: '[[Welcome]]\n[[Welcome|home page]]\n[[Welcome#Get started]]',
    en: 'Wikilink to a note in the workspace folder. Cmd/Ctrl+click to open. Type `[[` for autocomplete. Optional `|alias` and `#heading`.',
  },

  // Code
  {
    category: C.code,
    syntax: '```lang',
    example: '```js\nconsole.log("hi")\n```',
    en: 'Fenced code block, set the language for syntax highlighting',
  },
  {
    category: C.code,
    syntax: '    indent',
    example: '    indented code',
    en: 'Indenting 4 spaces also makes a code block',
  },

  // Quotes
  {
    category: C.quotes,
    syntax: '> quote',
    example: '> Knowledge is power.\n> — Bacon',
    en: 'Blockquote, can span multiple lines',
  },
  {
    category: C.quotes,
    syntax: '> > nested',
    example: '> outer\n> > inner',
    en: 'Nested blockquote',
  },

  // Tables
  {
    category: C.tables,
    syntax: '| h1 | h2 |',
    example: '| Name | Age |\n|------|-----|\n| Ada  | 36  |\n| Bob  | 24  |',
    en: 'Table: second row of --- is required; alignment with :--- :---: ---:',
  },

  // Math (KaTeX)
  {
    category: C.math,
    syntax: '$inline$',
    example: '$E = mc^2$',
    en: 'Inline math',
  },
  {
    category: C.math,
    syntax: '$$block$$',
    example: '$$\n\\int_0^\\infty e^{-x^2} dx\n$$',
    en: 'Block math',
  },

  // Mermaid
  {
    category: C.diagrams,
    syntax: '```mermaid',
    example: '```mermaid\nflowchart LR\nA --> B\nB --> C\n```',
    en: 'Diagram via Mermaid: flowchart / sequence / gantt etc.',
  },

  // Extras
  {
    category: C.extras,
    syntax: '[^1]',
    example: 'See note[^1].\n\n[^1]: This is the note.',
    en: 'Footnote: marker in text + definition at bottom',
  },
  {
    category: C.extras,
    syntax: '---\nkey: val\n---',
    example: '---\ntitle: My Doc\nauthor: Alex\n---\n\n# body',
    en: 'YAML front-matter (document metadata, must be at line 1)',
  },

  // Other
  {
    category: C.other,
    syntax: '---',
    example: 'Above\n\n---\n\nBelow',
    en: 'Horizontal rule (--- or *** or ___)',
  },
  {
    category: C.other,
    syntax: '\\*escape',
    example: '\\*literal asterisk\\*',
    en: 'Backslash to escape special characters',
  },
  {
    category: C.other,
    syntax: '  ↵',
    example: 'line one  \nline two',
    en: 'Two trailing spaces = hard line break',
  },
];
