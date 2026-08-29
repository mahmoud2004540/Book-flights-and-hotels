"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isBlocked: boolean;
  bookings: number;
  createdAt: string;
};

const ROLES: Role[] = ["USER", "SUPPORT", "FINANCE", "SUPER_ADMIN"];

/**
 * One account, with the two things staff actually do to it.
 *
 * A refusal from the server is shown next to the control that caused it. These
 * are all lockout rules — "this is the last super admin" — and a toast that
 * disappears is no use for a message someone has to act on.
 */
export function UserRow({
  user,
  canBlock,
  canSetRole,
}: {
  user: AdminUser;
  canBlock: boolean;
  canSetRole: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok?: boolean; reason?: string };
      if (!result.ok) {
        setError(result.reason ?? "That did not work.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className="px-4 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium">{user.name ?? "—"}</span>
          <span className="text-xs text-fg-muted">{user.email}</span>
          {error && (
            <span role="alert" className="mt-1 text-xs text-crit">
              {error}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {canSetRole ? (
          <select
            value={user.role}
            disabled={pending}
            aria-label={`Role for ${user.email}`}
            onChange={(event) => void send({ action: "role", role: event.target.value })}
            className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role.toLowerCase().replace("_", " ")}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-fg-muted">{user.role.toLowerCase().replace("_", " ")}</span>
        )}
      </td>
      <td className="px-4 py-2.5 tabular">{user.bookings}</td>
      <td className="px-4 py-2.5">
        {user.isBlocked ? <Badge tone="critical">blocked</Badge> : <Badge tone="neutral">active</Badge>}
      </td>
      <td className="px-4 py-2.5 text-end">
        {canBlock && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void send({ action: "block", blocked: !user.isBlocked })}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            {user.isBlocked ? "Unblock" : "Block"}
          </button>
        )}
      </td>
    </tr>
  );
}
