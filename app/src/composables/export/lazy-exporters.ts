// Loaded per export rather than at startup. Between them these pull in
// `docx`, jsPDF + html2canvas, the mermaid renderer and KaTeX's stylesheet —
// megabytes that a user who only opens a note to read it should never have to compile.
export const markdownToDocxBlob: typeof import('../../lib/docx-export')['markdownToDocxBlob'] =
  async (...args) => (await import('../../lib/docx-export')).markdownToDocxBlob(...args);
export const markdownToPdfBlob: typeof import('../../lib/pdf-export')['markdownToPdfBlob'] =
  async (...args) => (await import('../../lib/pdf-export')).markdownToPdfBlob(...args);
export const markdownToImageBlob: typeof import('../../lib/image-export')['markdownToImageBlob'] =
  async (...args) => (await import('../../lib/image-export')).markdownToImageBlob(...args);
export const buildStandaloneHtml: typeof import('../../lib/html-export')['buildStandaloneHtml'] =
  async (...args) => (await import('../../lib/html-export')).buildStandaloneHtml(...args);
