import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A form-level message. `role="alert"` so screen readers announce it when it
 * appears, rather than leaving it to be discovered.
 */
export function FormStatus({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <div
      role="alert"
      // Next renders its own empty role="alert" route announcer, so tests need
      // a hook that identifies this element specifically.
      data-form-status={tone}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm",
        tone === "error"
          ? "border-crit bg-crit-soft text-crit"
          : "border-accent bg-accent-soft text-accent",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
