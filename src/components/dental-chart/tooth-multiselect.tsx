"use client";

import { LOWER_LEFT, LOWER_RIGHT, UPPER_LEFT, UPPER_RIGHT } from "@/lib/dental";

export function ToothMultiselect({ defaultSelected = [] }: { defaultSelected?: number[] }) {
  const selected = new Set(defaultSelected);
  const upperRow = [...UPPER_RIGHT, ...UPPER_LEFT];
  const lowerRow = [...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT];

  return (
    <div className="border-border/70 flex flex-col items-center gap-3 rounded-xl border p-4">
      {[upperRow, lowerRow].map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((n, i) => (
            <label
              key={n}
              className={
                "peer-checked:bg-primary peer-checked:text-primary-foreground border-border/70 hover:bg-accent flex size-8 cursor-pointer items-center justify-center rounded-md border text-[10px] font-medium has-checked:bg-primary has-checked:text-primary-foreground has-checked:border-primary" +
                (i === 8 ? " ml-2" : "")
              }
            >
              <input type="checkbox" name="teeth" value={n} defaultChecked={selected.has(n)} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
