import type { ReactNode } from "react";
import { Plane } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { BRAND } from "@/lib/config";

/** The frame shared by every authentication screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-14 sm:px-6">
      <Link href="/" className="flex items-center gap-2 self-start font-semibold">
        <Plane className="size-5 text-brand" aria-hidden="true" />
        {BRAND.name}
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
      </div>

      {children}

      {footer && <div className="text-sm text-fg-muted">{footer}</div>}
    </div>
  );
}
