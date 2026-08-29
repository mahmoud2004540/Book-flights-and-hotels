import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/admin-guard";
import { can } from "@/lib/admin/permissions";
import { MarkupForm } from "@/components/admin/markup-form";
import { ToggleRow } from "@/components/admin/toggle-row";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminMarkupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const staff = await requireCapability("markup.read");
  const editable = can(staff.role, "markup.write");

  const [rules, suppliers] = await Promise.all([
    // Same order the pricing layer reads them in, so the page shows which rule
    // actually wins rather than a different sort of the same list.
    prisma.markupRule.findMany({ orderBy: [{ priority: "asc" }, { id: "asc" }] }),
    prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { priority: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Markup rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          The most specific rule wins, decided by priority — lowest number first.
          A rule with no supplier, service or destination is the catch-all, so it
          belongs at the highest number.
        </p>
      </div>

      {editable && <MarkupForm suppliers={suppliers} />}

      {rules.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-sm text-fg-muted">
            No rule yet. Without one every search falls back to
            DEFAULT_MARKUP_PERCENT.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-line text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">Priority</th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">Applies to</th>
                <th scope="col" className="px-4 py-2.5 text-end font-medium">Markup</th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">State</th>
                <th scope="col" className="px-4 py-2.5 text-end font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 tabular">{rule.priority}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{rule.supplierId ?? "all suppliers"}</Badge>
                      <Badge tone="neutral">
                        {rule.serviceType?.toLowerCase() ?? "flights and hotels"}
                      </Badge>
                      <Badge tone="neutral">{rule.destination ?? "everywhere"}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-end tabular">
                    {rule.type === "PERCENT"
                      ? `${Number(rule.value)}%`
                      : Number(rule.value).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5">
                    {rule.isActive ? (
                      <Badge tone="accent">active</Badge>
                    ) : (
                      <Badge tone="neutral">off</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    {editable && (
                      <ToggleRow
                        endpoint={`/api/admin/markup/${rule.id}`}
                        field="isActive"
                        value={rule.isActive}
                        labelOn="Turn on"
                        labelOff="Turn off"
                        describedAs={`rule at priority ${rule.priority}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
