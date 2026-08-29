import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/auth/admin-guard";
import { can } from "@/lib/admin/permissions";
import { UserRow } from "@/components/admin/user-row";
import { Card, CardBody } from "@/components/ui/card";

const PAGE_SIZE = 30;

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const staff = await requireCapability("users.read");

  const search = (await searchParams).q?.trim() ?? "";
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBlocked: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
    // Staff first, so the people with access are the ones on screen.
    orderBy: [{ role: "desc" }, { createdAt: "desc" }],
    take: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Users</h1>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Name or email"
          aria-label="Search users"
          className="min-w-56 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-sm text-fg-muted">No account matches that.</CardBody>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-line text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">Account</th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">Role</th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">Bookings</th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">State</th>
                <th scope="col" className="px-4 py-2.5 text-end font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  canBlock={can(staff.role, "users.block")}
                  canSetRole={can(staff.role, "users.role")}
                  user={{
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isBlocked: user.isBlocked,
                    bookings: user._count.bookings,
                    createdAt: user.createdAt.toISOString(),
                  }}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-fg-faint">Showing at most {PAGE_SIZE}. Narrow with a search.</p>
    </div>
  );
}
