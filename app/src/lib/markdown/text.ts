export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fff]/g, '');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
