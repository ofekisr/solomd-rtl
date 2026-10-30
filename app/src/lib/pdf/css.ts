export const PDF_CSS = `
  body { margin: 0; }
  .pdf-page {
    box-sizing: border-box;
    /* The container html2pdf hands us is exactly the printable width of the
       chosen page size (190mm → 718px for A4 with 10mm margins), so the page
       column has to fill it. A hard 760px column overflowed every narrower
       setup — A5 with the default margins is 118mm, "Wide" (25mm) margins on A4
       are 160mm — and the capture then cut the right edge off every line.
       760px stays as a cap so wide paper (landscape) doesn't stretch the
       measure, and the padding is proportional for the same reason: a fixed
       64px inset eats an A5 text column alive. */
    width: 100%;
    max-width: 760px;
    padding: 7.5% 8.5% 10%;
    color: #1f2328;
    background: #ffffff;
    font: 15px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto,
      "Helvetica Neue", Arial,
      "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
      "Noto Sans CJK SC", "WenQuanYi Micro Hei",
      system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    /* #293 — paper cannot scroll, so anything the layout engine refuses to
       break is lost off the right edge. Text carrying NO-BREAK SPACE between
       its words (a Word / web / chat paste) is exactly that: one unbreakable
       run as far as wrapping is concerned. Same reasoning as the pre rule
       below, applied to prose. */
    overflow-wrap: break-word;
  }
  .pdf-page h1, .pdf-page h2, .pdf-page h3,
  .pdf-page h4, .pdf-page h5, .pdf-page h6 {
    line-height: 1.25;
    font-weight: 700;
    color: #1f2328;
    margin: 1.8em 0 0.55em;
    page-break-after: avoid;
    break-after: avoid-page;
  }
  .pdf-page h1:first-child,
  .pdf-page h2:first-child,
  .pdf-page h3:first-child { margin-top: 0; }
  .pdf-page h1 {
    font-size: 2em;
    border-bottom: 2px solid #3d444d;
    padding-bottom: .32em;
    letter-spacing: -0.01em;
  }
  .pdf-page h2 {
    font-size: 1.5em;
    border-bottom: 1px solid #e4e6e9;
    padding-bottom: .25em;
  }
  .pdf-page h3 { font-size: 1.2em; }
  .pdf-page h4 { font-size: 1.05em; }
  .pdf-page h5, .pdf-page h6 { font-size: 1em; color: #59636e; }
  .pdf-page p { margin: .85em 0; }
  .pdf-page a {
    color: #0b5cad;
    text-decoration: none;
    border-bottom: 1px solid #c9dcf0;
  }
  .pdf-page code {
    font-family: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    font-size: .88em;
    background: #f6f8fa;
    padding: .15em .45em;
    border-radius: 4px;
    color: #1f2328;
  }
  .pdf-page pre {
    background: #f6f8fa;
    padding: 14px 18px;
    border-radius: 8px;
    /* #211 — paper can't scroll, so long code lines MUST wrap or they get
     * clipped at the page edge (reported as "overly long code blocks are cut off"). Always
     * soft-wrap in PDF regardless of the on-screen code-block-wrap setting. */
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
    margin: 1.1em 0;
    line-height: 1.55;
    border: 1px solid #e4e6e9;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-page pre code {
    background: transparent;
    padding: 0;
    font-size: .86em;
    color: #1f2328;
  }
  .pdf-page pre code .hljs-keyword,
  .pdf-page pre code .hljs-built_in,
  .pdf-page pre code .hljs-tag { color: #116329; }
  .pdf-page blockquote {
    border-left: 4px solid #3d444d;
    margin: 1.3em 0;
    padding: .5em 1.1em;
    color: #59636e;
    font-style: italic;
    background: #f9fafb;
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-page blockquote p { margin: .35em 0; }
  .pdf-page ul, .pdf-page ol { padding-left: 1.8em; margin: .9em 0; }
  .pdf-page li { margin: .3em 0; }
  .pdf-page table {
    border-collapse: collapse;
    margin: 1.3em 0;
    width: 100%;
    font-size: .95em;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-page th, .pdf-page td {
    border: 1px solid #e4e6e9;
    padding: 7px 13px;
    text-align: left;
  }
  /* #271 — short cells stay on one line (see markdown.ts table_short_cells). */
  .pdf-page .cell-nowrap { white-space: nowrap; }
  .pdf-page thead th {
    background: #f3f4f6;
    color: #1f2328;
    font-weight: 700;
    border-bottom: 2px solid #3d444d;
  }
  .pdf-page tbody tr:nth-child(even) { background: #f9fafb; }
  .pdf-page hr {
    border: none;
    border-top: 1px solid #e4e6e9;
    margin: 2.2em 0;
  }
  .pdf-page img {
    max-width: 100%;
    border-radius: 6px;
    margin: 1.1em 0;
  }
  .pdf-page .mermaid-block {
    display: flex;
    justify-content: center;
    margin: 1.5em 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-page .mermaid-block svg { max-width: 100%; height: auto; }
  .pdf-page .katex-display {
    overflow-x: auto;
    overflow-y: hidden;
    margin: 1em 0;
  }
`;
