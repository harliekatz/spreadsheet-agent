import test from "node:test";
import assert from "node:assert/strict";
import { runLayoutTransition } from "../src/lib/layoutTransition";
const commit = (change: () => void) => change();
test("fallback commits once", async () => {
  let count = 0;
  await runLayoutTransition(() => count++, commit);
  assert.equal(count, 1);
});
test("successful animation commits once", async () => {
  let count = 0;
  await runLayoutTransition(
    () => count++,
    commit,
    (update) => {
      update();
      return { finished: Promise.resolve() };
    },
  );
  assert.equal(count, 1);
});
test("failed capture still applies the requested layout", async () => {
  let count = 0;
  await runLayoutTransition(
    () => count++,
    commit,
    () => {
      throw Error("capture failed");
    },
  );
  assert.equal(count, 1);
});
test("interrupted animation does not apply the change twice", async () => {
  let count = 0;
  await runLayoutTransition(
    () => count++,
    commit,
    (update) => {
      update();
      return {
        ready: Promise.reject(Error("skipped")),
        finished: Promise.reject(Error("interrupted")),
      };
    },
  );
  assert.equal(count, 1);
});
test("queued requests preserve their order", async () => {
  const values: number[] = [];
  let queue = Promise.resolve();
  for (const value of [1, 2, 3])
    queue = queue.then(() =>
      runLayoutTransition(() => {
        values.push(value);
      }, commit),
    );
  await queue;
  assert.deepEqual(values, [1, 2, 3]);
});
