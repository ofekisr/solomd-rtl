import { fsPort, pathPort } from '../../platform/index.ts';
import { contentUriFileName } from './file-names.ts';

/** #148 — Android delivers file-manager / "Open with" / picker files as SAF
 *  `content://` URIs, which neither std::fs nor our whole path-based stack
 *  can read (the raw URI reached fs::read and failed with os error 2).
 *  Import the bytes through the fs plugin's ContentResolver bridge into the
 *  SoloMD Documents folder — mirroring what iOS does with Files-app opens —
 *  and hand back a real filesystem path for the rest of openPath. */
export async function importContentUri(uri: string): Promise<string> {
  const bytes = await pathPort.readFile(uri);
  const name = contentUriFileName(uri, bytes, Date.now());
  const dir = await pathPort.documentDir();
  let dest = await pathPort.join(dir, name);
  // Never overwrite an existing note the user may have edited — pick a
  // suffixed sibling instead.
  if (await pathPort.exists(dest)) {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let n = 1;
    while (await pathPort.exists(dest)) {
      dest = await pathPort.join(dir, `${stem}-${n}${ext}`);
      n += 1;
    }
  }
  await fsPort.writeBinaryFile({ path: dest, data: Array.from(bytes) });
  return dest;
}

/** Android — write to a SAF `content://` URI through the fs plugin's
 *  ContentResolver bridge ("wt" mode: write + truncate). Rust's std::fs
 *  cannot open content URIs — routing them into our `write_file` command
 *  failed with "No such file or directory (os error 2)" AFTER the SAF
 *  save dialog had already created the (empty) document, which is how
 *  "Save As produced a 0-byte file" happened on Android. */
export async function writeContentUri(uri: string, payload: string): Promise<void> {
  await pathPort.writeTextFile(uri, payload);
}
