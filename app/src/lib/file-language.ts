import type { Language } from '../types';

const languagesByExtension = new Map<string, Language>([
  ['md', 'markdown'], ['markdown', 'markdown'], ['mdown', 'markdown'], ['mkd', 'markdown'],
  ['js', 'javascript'], ['jsx', 'javascript'], ['mjs', 'javascript'], ['cjs', 'javascript'],
  ['ts', 'typescript'], ['tsx', 'typescript'], ['py', 'python'], ['pyj', 'python'], ['rs', 'rust'],
  ['html', 'html'], ['htm', 'html'], ['css', 'css'], ['json', 'json'], ['java', 'java'],
  ['yaml', 'yaml'], ['yml', 'yaml'], ['xml', 'xml'],
  ['c', 'cpp'], ['cpp', 'cpp'], ['cc', 'cpp'], ['h', 'cpp'], ['hpp', 'cpp'],
  ['go', 'go'], ['sql', 'sql'],
  ['shell', 'bash'], ['sh', 'bash'], ['bash', 'bash'], ['zsh', 'bash'],
]);

const shellStartupFiles = new Set([
  '.bashrc', '.bash_profile', '.bash_login', '.bash_logout', '.profile',
  '.zshrc', '.zshenv', '.zprofile', '.zlogin', '.zlogout',
]);

export function inferFileLanguage(path: string): Language {
  const name = path.split(/[\\/]/).pop() ?? '';
  if (shellStartupFiles.has(name.toLowerCase())) return 'bash';
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return 'plaintext';
  const extension = name.slice(dotIndex + 1).toLowerCase();
  return languagesByExtension.get(extension) ?? 'plaintext';
}
