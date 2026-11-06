import React from 'react';

interface Props {
  /** days in one full supply */
  total: number;
  /** days that are left */
  left: number;
  label: string;
}

/**
 * Your supply as a blister strip: one cell for each day. The cells that are still full are green, and they
 * turn marigold when three days or fewer are left. A glance tells you how close you are to running out.
 */
export default function PillStrip({ total, left, label }: Props) {
  const cells = Math.min(Math.max(Math.round(total), 7), 42);
  const filled = Math.min(Math.max(left, 0), cells);
  const perRow = cells > 16 ? Math.ceil(cells / 2) : cells;
  const soon = left <= 5; // everything in "Running low" is due within five days

  return (
    <div role="img" aria-label={label} className="rounded-2xl bg-stone-100 p-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
        {Array.from({ length: cells }).map((_, i) => {
          // pills are taken from the front, so the ones still in the pack are at the end
          const stillThere = i >= cells - filled;
          return (
            <span
              key={i}
              className={`aspect-square rounded-full ${
                stillThere
                  ? soon
                    ? 'bg-marigold-500'
                    : 'bg-teal-600'
                  : 'bg-stone-200 shadow-[inset_0_1px_2px_rgba(58,52,30,0.28)]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
