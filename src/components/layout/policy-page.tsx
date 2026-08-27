import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/**
 * The legal pages required by section 14.
 * The routes exist from the start so the footer never links to a 404;
 * the final text is legally reviewed and written in stage 8 before launch.
 */
export function PolicyPage({ page }: { page: string }) {
  const t = useTranslations("footer");
  const tStatus = useTranslations("policy");

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16 sm:px-6">
      <Badge tone="brand" className="self-start">
        {tStatus("pending")}
      </Badge>
      <h1 className="text-3xl font-semibold text-balance">{t(page)}</h1>
      <p className="text-fg-muted">{tStatus("body")}</p>
    </article>
  );
}
