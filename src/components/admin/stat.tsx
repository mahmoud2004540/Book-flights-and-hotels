import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";

/**
 * One figure, named. The number leads and the label follows, because the label
 * is only read once and the number is read every time.
 */
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-1 p-4 sm:p-5">
        <span className="text-2xl font-semibold tabular">{value}</span>
        <span className="text-sm text-fg-muted">{label}</span>
        {detail && <span className="text-xs text-fg-faint">{detail}</span>}
      </CardBody>
    </Card>
  );
}
