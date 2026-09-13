import gsap from "gsap";

gsap.ticker.lagSmoothing(0);

export const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Wait, but collapse to almost nothing when the user asked for less motion. */
export const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

/** Fill headers then cells, so construction is visible rather than instant. */
export async function populateGrid(root: HTMLElement) {
  if (reducedMotion()) return;
  const headers = root.querySelectorAll(".data-header .cell-text");
  const cells = root.querySelectorAll(".data-cell.filled .cell-text");
  const stagger = Math.min(0.022, 1.8 / Math.max(cells.length, 1));

  gsap.set([headers, cells], { opacity: 0 });
  await gsap.to(headers, { opacity: 1, duration: 0.16, stagger: 0.06 });
  await gsap.to(cells, {
    opacity: 1,
    duration: 0.12,
    stagger: { each: stagger },
    onStart: () => {
      gsap.fromTo(
        root.querySelectorAll(".data-cell.filled"),
        { backgroundColor: "var(--fill-flash)" },
        {
          backgroundColor: "var(--surface)",
          duration: 0.6,
          stagger: { each: stagger },
          delay: 0.1,
          clearProps: "backgroundColor",
        },
      );
    },
  });
}

export function rowPositions(root: HTMLElement) {
  return new Map(
    Array.from(root.querySelectorAll<HTMLElement>("[data-row-id]")).map((row) => [
      row.dataset.rowId!,
      row.getBoundingClientRect().top,
    ]),
  );
}

/** FLIP the rows that survived a filter or sort from their old positions. */
export async function animateRows(root: HTMLElement, before: Map<string, number>) {
  if (reducedMotion()) return;
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLElement>("[data-row-id]")).map((row) => {
      const previous = before.get(row.dataset.rowId!);
      return gsap.fromTo(
        row,
        {
          y: previous === undefined ? 8 : previous - row.getBoundingClientRect().top,
          opacity: previous === undefined ? 0 : 1,
        },
        { y: 0, opacity: 1, duration: 0.45, ease: "power2.inOut" },
      );
    }),
  );
}
