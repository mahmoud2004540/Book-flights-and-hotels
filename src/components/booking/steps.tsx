import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEP_LABELS = [
  "Your flight",
  "Confirm price",
  "Travellers",
  "Extras",
  "Review and pay",
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

/** The five-step progress rail — section 4.5. */
export function StepRail({ current }: { current: StepIndex }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STEP_LABELS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-accent bg-accent text-white",
                active && "border-brand bg-brand-soft text-brand",
                !done && !active && "border-line text-fg-faint",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn(active ? "font-medium text-fg" : "text-fg-muted")}>{label}</span>
            {index < STEP_LABELS.length - 1 && (
              <span className="hidden h-px w-6 bg-line sm:block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
