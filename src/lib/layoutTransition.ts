/** Commit a layout exactly once, even if a browser skips its animation. */
export async function runLayoutTransition(
  change: () => void,
  commit: (change: () => void) => void,
  start?: (change: () => void) => { finished: Promise<void>; ready?: Promise<void> },
): Promise<void> {
  let applied = false;
  let commitError: unknown;
  let commitFailed = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    try {
      commit(change);
    } catch (error) {
      commitFailed = true;
      commitError = error;
      throw error;
    }
  };
  if (!start) {
    apply();
    return;
  }
  try {
    const transition = start(apply);
    // A skipped snapshot must not become an unhandled rejection.
    void transition.ready?.catch(() => {});
    await transition.finished;
  } catch {
    // The state change still needs to happen when capture itself fails.
  }
  if (commitFailed) throw commitError;
  apply();
}
