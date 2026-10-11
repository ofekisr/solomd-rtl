#!/usr/bin/env node

import { access, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SEPARATOR_SEQUENCE = /[\s,_()-]{2,}/gu;
const LEADING_OR_TRAILING_SEPARATOR = /^[\s,_()-]+|[\s,_()-]+$/gu;
const USAGE = `Usage: batch-rename <folder-path> [<pattern>] [-p <pattern>] [--reg <regex>] [-rd]

Options:
  -p, --pattern <pattern>  Add patterns separated by spaces or "|"
  --reg <regex>            Add a JavaScript regex (repeatable; flags: giu)
  -d, --dry-run            Print changes without renaming files
  -r, --recursive          Include files in nested folders
  -h, --help               Show this help`;

function splitPatterns(value) {
  return value.split(/[|\s]+/u).filter(Boolean);
}

function parseArgs(args) {
  const options = {
    directoryPath: '',
    patterns: [],
    regexPatterns: [],
    isDryRun: false,
    isRecursive: false,
  };
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '-p' || argument === '--pattern') {
      const pattern = args[index + 1];
      if (!pattern) throw new Error(`${argument} requires a pattern`);
      options.patterns.push(...splitPatterns(pattern));
      index += 1;
    } else if (argument === '--reg') {
      const regexPattern = args[index + 1];
      if (!regexPattern) throw new Error('--reg requires a regex pattern');
      options.regexPatterns.push(regexPattern);
      index += 1;
    } else if (argument === '--dry-run') {
      options.isDryRun = true;
    } else if (argument === '--recursive') {
      options.isRecursive = true;
    } else if (argument === '-h' || argument === '--help') {
      options.hasHelp = true;
    } else if (/^-[rd]+$/u.test(argument)) {
      options.isDryRun ||= argument.includes('d');
      options.isRecursive ||= argument.includes('r');
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }

  options.directoryPath = positional.shift() ?? '';
  options.patterns.unshift(...positional.flatMap(splitPatterns));
  return options;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function compileMatchers(patterns, regexPatterns) {
  const literalMatchers = patterns.map(
    (pattern) => new RegExp(escapeRegularExpression(pattern), 'giu'),
  );
  const regexMatchers = regexPatterns.map((pattern) => new RegExp(pattern, 'giu'));
  return [...literalMatchers, ...regexMatchers];
}

function buildTargetName(fileName, matchers) {
  const extension = path.extname(fileName);
  let stem = extension ? fileName.slice(0, -extension.length) : fileName;
  let hasMatch = false;

  for (const matcher of matchers) {
    const updatedStem = stem.replace(matcher, '');
    hasMatch ||= updatedStem !== stem;
    stem = updatedStem;
  }
  if (!hasMatch) return fileName;

  const cleanStem = stem
    .replace(SEPARATOR_SEQUENCE, '-')
    .replace(LEADING_OR_TRAILING_SEPARATOR, '');

  return cleanStem ? `${cleanStem}${extension}` : null;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function renameFile(directoryPath, fileName, options) {
  const targetName = buildTargetName(fileName, options.matchers);
  if (!targetName || targetName === fileName) return;

  const sourcePath = path.join(directoryPath, fileName);
  const targetPath = path.join(directoryPath, targetName);
  if (await pathExists(targetPath)) {
    console.error(`Skipped ${sourcePath}: destination already exists: ${targetPath}`);
    return;
  }

  console.log(`${fileName} -> ${targetName}`);
  if (!options.isDryRun) await rename(sourcePath, targetPath);
}

async function processDirectory(directoryPath, options) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory() && options.isRecursive) {
      await processDirectory(entryPath, options);
    } else if (entry.isFile()) {
      await renameFile(directoryPath, entry.name, options);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.hasHelp) {
    console.log(USAGE);
    return;
  }
  const hasPatterns = options.patterns.length > 0 || options.regexPatterns.length > 0;
  if (!options.directoryPath || !hasPatterns) {
    throw new Error(`A folder path and at least one pattern are required\n\n${USAGE}`);
  }

  const directoryPath = path.resolve(options.directoryPath);
  const directoryStats = await stat(directoryPath);
  if (!directoryStats.isDirectory()) throw new Error(`Not a directory: ${directoryPath}`);

  options.matchers = compileMatchers(options.patterns, options.regexPatterns);
  await processDirectory(directoryPath, options);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
