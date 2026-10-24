import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MINDMAP_LAYOUT } from './mindmap-direction.ts';
import { frameDelta, insetRect, panDelta, parseTranslate, type FrameRect } from './mindmap-frame.ts';

const container: FrameRect = { left: 0, top: 0, width: 1000, height: 600 };
const PAD = 40;

test('content that fits is centred by its bounding box', () => {
  const content = { left: 500, top: 100, width: 400, height: 200 };
  const root = { left: 500, top: 180, width: 100, height: 40 };
  assert.deepEqual(frameDelta({ container, content, root, layout: MINDMAP_LAYOUT.RIGHT, padding: PAD }), { dx: -200, dy: 100 });
});

test('a wide right map anchors its start edge at the padding', () => {
  const content = { left: 300, top: 250, width: 1400, height: 100 };
  const root = { left: 300, top: 280, width: 200, height: 40 };
  assert.deepEqual(frameDelta({ container, content, root, layout: MINDMAP_LAYOUT.RIGHT, padding: PAD }), { dx: -260, dy: 0 });
});

test('a wide left map anchors its end edge at the padding', () => {
  const content = { left: -800, top: 250, width: 1400, height: 100 };
  const root = { left: 400, top: 250, width: 200, height: 100 };
  const { dx } = frameDelta({ container, content, root, layout: MINDMAP_LAYOUT.LEFT, padding: PAD });
  assert.equal(dx, 1000 - PAD - 600);
});

test('a wide side map centres the root', () => {
  const content = { left: -300, top: 250, width: 1600, height: 100 };
  const root = { left: 400, top: 250, width: 100, height: 100 };
  assert.equal(frameDelta({ container, content, root, layout: MINDMAP_LAYOUT.SIDE, padding: PAD }).dx, 50);
});

test('a tall down map anchors its top edge at the padding', () => {
  const content = { left: 300, top: 200, width: 400, height: 900 };
  const root = { left: 450, top: 200, width: 100, height: 40 };
  assert.equal(frameDelta({ container, content, root, layout: MINDMAP_LAYOUT.DOWN, padding: PAD }).dy, PAD - 200);
});

test('a tall right map centres the root vertically', () => {
  const content = { left: 300, top: -200, width: 400, height: 900 };
  const root = { left: 300, top: 400, width: 100, height: 40 };
  assert.equal(frameDelta({ container, content, root, layout: MINDMAP_LAYOUT.RIGHT, padding: PAD }).dy, 300 - 420);
});

test('parseTranslate reads translate3d offsets and defaults to zero', () => {
  assert.deepEqual(parseTranslate('translate3d(-12.5px, 30px, 0) scale(1)'), { x: -12.5, y: 30 });
  assert.deepEqual(parseTranslate(''), { x: 0, y: 0 });
});

test('insetRect trims padding on both sides and never goes negative', () => {
  assert.deepEqual(insetRect({ left: 0, top: 0, width: 200, height: 100 }, 80, 50), { left: 80, top: 50, width: 40, height: 0 });
});

test('panning moves freely while the map stays well inside the view', () => {
  const content = { left: 300, top: 200, width: 400, height: 200 };
  assert.deepEqual(panDelta({ container, content, dx: -250, dy: 150, keepVisible: PAD }), { dx: -250, dy: 150 });
});

test('panning past the centre is allowed until only the visible strip remains', () => {
  const content = { left: 300, top: 200, width: 400, height: 200 };
  assert.deepEqual(panDelta({ container, content, dx: -900, dy: 0, keepVisible: PAD }), { dx: -660, dy: 0 });
  assert.deepEqual(panDelta({ container, content, dx: 900, dy: 0, keepVisible: PAD }), { dx: 660, dy: 0 });
  assert.deepEqual(panDelta({ container, content, dx: 0, dy: -900, keepVisible: PAD }), { dx: 0, dy: -360 });
  assert.deepEqual(panDelta({ container, content, dx: 0, dy: 900, keepVisible: PAD }), { dx: 0, dy: 360 });
});

test('a map already pushed to the edge only pans back into view', () => {
  const content = { left: -360, top: 200, width: 400, height: 200 };
  assert.deepEqual(panDelta({ container, content, dx: -50, dy: 0, keepVisible: PAD }), { dx: 0, dy: 0 });
  assert.deepEqual(panDelta({ container, content, dx: 50, dy: 0, keepVisible: PAD }), { dx: 50, dy: 0 });
});
