import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sessionUser = await requireUser("/profile");
  const t = await getTranslations("account");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { email: true, name: true, emailVerifiedAt: true, createdAt: true },
  });

  const rows = [
    { label: t("profile"), value: user.name ?? "—" },
    {
      label: t("accountEmail"),
      value: user.email,
      badge: user.emailVerifiedAt ? t("verified") : undefined,
    },
    { label: t("memberSince"), value: formatDate(user.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("profile")}</h1>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {rows.map(({ label, value, badge }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="label-caps text-xs text-fg-faint">{label}</span>
              <span className="flex items-center gap-2 text-sm">
                {value}
                {badge && <Badge tone="accent">{badge}</Badge>}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
