import { getTranslations, setRequestLocale } from "next-intl/server";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { decryptSecret, maskDocument } from "@/lib/crypto";
import { formatDate } from "@/lib/format";

/**
 * Passport numbers are decrypted here on the server and only the masked form
 * reaches the browser — the plaintext never crosses the network.
 */
function safeDocument(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return maskDocument(decryptSecret(encrypted));
  } catch {
    // A value that will not decrypt means a rotated or wrong ENCRYPTION_KEY.
    // Showing nothing is correct; the rest of the traveller is still usable.
    return null;
  }
}

export default async function TravellersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser("/travellers");
  const t = await getTranslations("account");

  const travellers = await prisma.savedTraveler.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("travellers")}</h1>

      {travellers.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-start gap-3 py-10">
            <Users className="size-6 text-fg-faint" aria-hidden="true" />
            <h2 className="font-semibold">{t("noTravellersTitle")}</h2>
            <p className="max-w-md text-sm text-fg-muted">{t("noTravellersBody")}</p>
          </CardBody>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {travellers.map((traveller) => {
            const document = safeDocument(traveller.passportNoEnc);
            return (
              <li key={traveller.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {traveller.firstName} {traveller.lastName}
                      </span>
                      <span className="text-xs text-fg-muted">
                        {formatDate(traveller.dob)}
                        {document && <span className="ms-2 font-mono">{document}</span>}
                      </span>
                    </div>
                    <Badge>{traveller.type}</Badge>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
