import { Role } from "@prisma/client";

/**
 * The rules that keep the admin area administrable — section 7.
 *
 * Pure, because these are the cases that matter most and the ones hardest to
 * reach through the UI: they are all about the last person who can undo a
 * mistake, and they must hold whether the request came from a form or a script.
 */

export type Decision = { allowed: true } | { allowed: false; reason: string };

const ALLOWED: Decision = { allowed: true };
const refuse = (reason: string): Decision => ({ allowed: false, reason });

export type RoleChange = {
  actorId: string;
  actorRole: Role;
  targetId: string;
  targetRole: Role;
  nextRole: Role;
  /** How many super admins exist right now, the target included. */
  superAdminCount: number;
};

export function canChangeRole(change: RoleChange): Decision {
  if (change.actorRole !== Role.SUPER_ADMIN) {
    return refuse("Only a super admin can change a role.");
  }

  // Self-demotion is how an organisation locks itself out one careless click at
  // a time, and it is never urgent enough to allow — another super admin can do
  // it, which also leaves the change attributable to someone else.
  if (change.actorId === change.targetId) {
    return refuse("You cannot change your own role. Ask another super admin.");
  }

  if (change.targetRole === change.nextRole) {
    return refuse("That is already their role.");
  }

  // The last super admin leaving is unrecoverable through the app: nobody left
  // can grant the role back.
  if (
    change.targetRole === Role.SUPER_ADMIN &&
    change.nextRole !== Role.SUPER_ADMIN &&
    change.superAdminCount <= 1
  ) {
    return refuse("This is the last super admin. Promote someone else first.");
  }

  return ALLOWED;
}

export type BlockChange = {
  actorId: string;
  targetId: string;
  targetRole: Role;
  blocked: boolean;
  superAdminCount: number;
};

export function canBlock(change: BlockChange): Decision {
  if (change.actorId === change.targetId) {
    return refuse("You cannot block your own account.");
  }

  if (
    change.blocked &&
    change.targetRole === Role.SUPER_ADMIN &&
    change.superAdminCount <= 1
  ) {
    return refuse("This is the last super admin. Blocking them locks everyone out.");
  }

  return ALLOWED;
}
