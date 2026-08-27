import { getTranslations, setRequestLocale } from "next-intl/server";
import { Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/card";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser("/dashboard");
  const t = await getTranslations("account");

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">
        {t("greeting", { name: user.name ?? user.email })}
      </h1>

      {bookings.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-start gap-3 py-10">
            <Ticket className="size-6 text-fg-faint" aria-hidden="true" />
            <h2 className="font-semibold">{t("noBookingsTitle")}</h2>
            <p className="max-w-md text-sm text-fg-muted">{t("noBookingsBody")}</p>
          </CardBody>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Card>
                <CardBody className="flex items-center justify-between gap-4">
                  <span className="font-mono text-sm">{booking.reference}</span>
                  <span className="text-sm text-fg-muted">{booking.status}</span>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
