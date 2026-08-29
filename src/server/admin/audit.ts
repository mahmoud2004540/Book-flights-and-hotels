import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "./guard";

/**
 * Records what a member of staff changed — section 7.
 *
 * Every admin mutation writes one of these before it returns. An admin action
 * with no trail is indistinguishable from an intrusion afterwards, which is
 * exactly when someone needs to tell them apart.
 *
 * The write is awaited rather than fired off: a change that is applied but
 * unrecorded is the failure this exists to prevent.
 */
export async function record(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  diff?: Prisma.InputJsonValue,
): Promise<void> {
  const list = await headers();

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entity,
      entityId,
      diff: diff ?? undefined,
      // Behind Vercel the socket address is the proxy's, so the forwarded
      // header is the only useful value; its first entry is the client.
      ip: list.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: list.get("user-agent")?.slice(0, 500) ?? null,
    },
  });
}
