export function quoteFontFamily(family: string): string {
  const trimmed = family.trim();
  // Already a stack with commas — pass through.
  if (trimmed.includes(',')) return trimmed;
  // Already quoted.
  if (/^["']/.test(trimmed)) return trimmed;
  // Quote if it contains whitespace.
  if (/\s/.test(trimmed)) return `"${trimmed}"`;
  return trimmed;
}
