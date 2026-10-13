#!/usr/bin/env node
//
// Records demo stories as captioned videos: runs the Playwright story, trims the app
// boot off the front, and writes out/<story>.mp4 plus a README-sized out/<story>.gif.
//
// Usage: node record.mjs <story-prefix|all> [--no-gif] [--dry-run]
//   node record.mjs 03          → stories/03-*.story.ts
//   node record.mjs all         → every story, then out/solomd-rtl-demo.mp4 joining them in order
// DEMO_SPEED (default 1.25) speeds up playback at encode time.

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMOS_DIR = path.dirname(fileURLToPath(import.meta.url));
const STORIES_DIR = path.join(DEMOS_DIR, 'stories');
const OUT_DIR = path.join(DEMOS_DIR, 'out');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const TIMING_DIR = path.join(OUT_DIR, 'timing');
const STORY_SUFFIX = '.story.ts';
const MP4_FPS = '30';
const MP4_CRF = '18';
const SPEED = Number(process.env.DEMO_SPEED ?? '1.25');
const FULL_VIDEO = 'solomd-rtl-demo.mp4';
const GIF_FPS = 12;
const GIF_WIDTH = 960;
const USAGE = 'usage: pnpm demo <story-prefix|all> [--no-gif] [--dry-run]';
const EXIT_USAGE = 2;
const EXIT_FAILED = 1;

const args = process.argv.slice(2);
const selector = args.find((a) => !a.startsWith('-'));
const isDryRun = args.includes('--dry-run');
const wantsGif = !args.includes('--no-gif');

function fail(message, code = EXIT_FAILED) {
  console.error(`[demo] ${message}`);
  process.exit(code);
}

function listStories() {
  return fs.readdirSync(STORIES_DIR).filter((f) => f.endsWith(STORY_SUFFIX)).sort();
}

function selectStories(sel) {
  const all = listStories();
  if (sel === 'all') return all;
  return all.filter((f) => f.startsWith(sel));
}

function assertFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    fail('ffmpeg not found — install it with: brew install ffmpeg');
  }
}

function storyName(file) {
  return file.slice(0, -STORY_SUFFIX.length);
}

function findVideo(file) {
  const dir = fs.readdirSync(RAW_DIR).find((d) => d.startsWith(`${file}-`));
  const video = dir && path.join(RAW_DIR, dir, 'video.webm');
  return video && fs.existsSync(video) ? video : null;
}

function trimSeconds(name) {
  const timingFile = path.join(TIMING_DIR, `${name}.json`);
  if (!fs.existsSync(timingFile)) return 0;
  const { trimStartMs } = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
  return trimStartMs / 1000;
}

function encodeMp4(video, start, outFile) {
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-ss', start.toFixed(2), '-i', video,
    '-vf', `setpts=PTS/${SPEED}`, '-c:v', 'libx264', '-preset', 'slow', '-crf', MP4_CRF, '-pix_fmt', 'yuv420p',
    '-r', MP4_FPS, '-movflags', '+faststart', outFile,
  ], { stdio: 'inherit' });
}

function encodeGif(mp4, outFile) {
  const filter = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];` +
    '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, '-filter_complex', filter, outFile], {
    stdio: 'inherit',
  });
}

function concatAll(names) {
  const listFile = path.join(OUT_DIR, 'concat-list.txt');
  const outFile = path.join(OUT_DIR, FULL_VIDEO);
  fs.writeFileSync(listFile, names.map((n) => `file '${path.join(OUT_DIR, `${n}.mp4`)}'`).join('\n'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy', '-movflags', '+faststart', outFile], { stdio: 'inherit' });
  fs.rmSync(listFile, { force: true });
  console.log(`[demo] all stories → ${path.relative(DEMOS_DIR, outFile)}`);
}

function runStory(file) {
  try {
    execFileSync('pnpm', ['exec', 'playwright', 'test', `stories/${file}`], {
      cwd: DEMOS_DIR,
      stdio: 'inherit',
    });
    return true;
  } catch {
    return false;
  }
}

function recordOne(file) {
  const name = storyName(file);
  if (!runStory(file)) {
    console.error(`[demo] ${name}: story failed — no video written; see out/raw/*/trace.zip`);
    return false;
  }
  const video = findVideo(file);
  if (!video) {
    console.error(`[demo] ${name}: no video recorded (story failed?)`);
    return false;
  }
  const mp4 = path.join(OUT_DIR, `${name}.mp4`);
  encodeMp4(video, trimSeconds(name), mp4);
  if (wantsGif) encodeGif(mp4, path.join(OUT_DIR, `${name}.gif`));
  console.log(`[demo] ${name} → ${path.relative(DEMOS_DIR, mp4)}${wantsGif ? ' (+ .gif)' : ''}`);
  return true;
}

if (!selector || args.includes('--help')) fail(USAGE, selector ? 0 : EXIT_USAGE);
const files = selectStories(selector);
if (files.length === 0) fail(`no story matches "${selector}" — have: ${listStories().join(', ')}`, EXIT_USAGE);

if (isDryRun) {
  console.log(`[demo] would record: ${files.join(', ')}`);
  console.log(`[demo] output: ${path.relative(DEMOS_DIR, OUT_DIR)}/<story>.mp4${wantsGif ? ' + .gif' : ''}`);
  process.exit(0);
}

assertFfmpeg();
fs.rmSync(TIMING_DIR, { recursive: true, force: true });
const rendered = files.map(recordOne).filter(Boolean).length;
console.log(`[demo] ${rendered}/${files.length} videos rendered at ${SPEED}x`);
if (selector === 'all' && rendered === files.length) concatAll(files.map(storyName));
process.exit(rendered === files.length ? 0 : EXIT_FAILED);
