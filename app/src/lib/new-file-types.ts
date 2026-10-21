export interface NewFileType {
  ext: string;
  label: string;
  icon: string;
}

export const NEW_FILE_TYPES: readonly NewFileType[] = [
  { ext: 'md', label: 'Markdown', icon: '📝' },
  { ext: 'mmap', label: 'Mind Map', icon: '🧠' },
  { ext: 'json', label: 'JSON', icon: '{}' },
  { ext: 'yaml', label: 'YAML', icon: '⚙' },
  { ext: 'html', label: 'HTML', icon: '🌐' },
  { ext: 'js', label: 'JavaScript', icon: 'JS' },
  { ext: 'ts', label: 'TypeScript', icon: 'TS' },
  { ext: 'py', label: 'Python', icon: '🐍' },
  { ext: 'sh', label: 'Shell', icon: '$' },
];

export const DEFAULT_NEW_FILE_EXT = 'md';
const NEW_FILE_STEM = 'untitled';

export function newFilePlaceholder(ext: string = DEFAULT_NEW_FILE_EXT): string {
  return `${NEW_FILE_STEM}.${ext}`;
}
