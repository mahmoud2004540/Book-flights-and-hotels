import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Coins, ShieldCheck, Users } from "lucide-react";
import { SearchPanel } from "@/components/home/search-panel";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations("home");
  const tStatus = useTranslations("status");

  const trustPoints = [
    { key: "price", Icon: Coins },
    { key: "suppliers", Icon: ShieldCheck },
    { key: "selfServe", Icon: Users },
  ] as const;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 sm:pt-20">
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="label-caps text-xs font-semibold text-brand">
              {t("eyebrow")}
            </span>
            <Badge tone="brand">{tStatus("comingSoon")}</Badge>
          </div>
          <h1 className="text-3xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl">
            {t("title")}
          </h1>
          <p className="text-lg text-fg-muted">{t("subtitle")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <SearchPanel />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {trustPoints.map(({ key, Icon }) => (
            <Card key={key}>
              <CardBody className="flex flex-col gap-2">
                <Icon className="size-5 text-accent" aria-hidden="true" />
                <h2 className="font-semibold">{t(`trust.${key}Title`)}</h2>
                <p className="text-sm text-fg-muted">{t(`trust.${key}Body`)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
