import { setRequestLocale } from "next-intl/server";
import { PolicyPage } from "@/components/layout/policy-page";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PolicyPage page="refunds" />;
}
