// Controls that write when released (Phase 8). One device session must never see
// two writes interleave, and a slider moved during a write should end on the
// newest value, not on every value it passed. So a panel routes all its writes
// through one queue: tasks run one at a time, in order, and a control's commit is
// queued at most once per row. The write reads the row's requested value when its
// turn comes, so the latest value wins.

export function rowWriter<R>(applyNow: (row: R) => Promise<void>) {
  let last: Promise<void> = Promise.resolve();
  const waiting = new Set<R>();
  const run = (task: () => Promise<void>): Promise<void> => {
    const next = last.then(task);
    last = next.catch(() => {});
    return next;
  };
  return {
    /** Every write (Apply buttons, profiles), in order after whatever is running. */
    apply: (row: R) => run(() => applyNow(row)),
    /** A control's commit: set the row's requested value first, then call this. */
    commit(row: R): void {
      if (waiting.has(row)) return;
      waiting.add(row);
      void run(async () => {
        waiting.delete(row);
        await applyNow(row);
      });
    },
    /** True while a newer commit for the row is still queued (so don't snap the control back yet). */
    queued: (row: R) => waiting.has(row),
  };
}
