import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/admin-guard";
import { can } from "@/lib/admin/permissions";
import { ToggleRow } from "@/components/admin/toggle-row";
import { SupplierOrder } from "@/components/admin/supplier-order";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSuppliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const staff = await requireCapability("suppliers.read");
  const editable = can(staff.role, "suppliers.write");

  const suppliers = await prisma.supplier.findMany({
    orderBy: { priority: "asc" },
    include: { _count: { select: { bookings: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          Every active supplier is searched at once and the cheapest result wins,
          so this order never makes anyone pay more. It settles a tie: the same
          flight at the same price goes to whichever supplier sits highest here.
        </p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="border-b border-line text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">Supplier</th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">Tie-break order</th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">Bookings</th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">State</th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier, index) => (
              <tr key={supplier.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="font-medium">{supplier.name}</span>
                    <span className="font-mono text-xs text-fg-muted">{supplier.id}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {editable ? (
                    <SupplierOrder
                      supplierId={supplier.id}
                      name={supplier.name}
                      isFirst={index === 0}
                      isLast={index === suppliers.length - 1}
                    />
                  ) : (
                    <span className="tabular">{supplier.priority}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-end tabular">{supplier._count.bookings}</td>
                <td className="px-4 py-2.5">
                  {supplier.isActive ? (
                    <Badge tone="accent">searched</Badge>
                  ) : (
                    <Badge tone="neutral">off</Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-end">
                  {editable && (
                    <ToggleRow
                      endpoint={`/api/admin/suppliers/${supplier.id}`}
                      field="isActive"
                      value={supplier.isActive}
                      labelOn="Turn on"
                      labelOff="Turn off"
                      describedAs={supplier.name}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardBody className="text-sm text-fg-muted">
          A supplier switched off keeps every booking it already sold — turning
          it off only stops new searches reaching it.
        </CardBody>
      </Card>
    </div>
  );
}
