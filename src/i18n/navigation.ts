import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware replacements for Link, useRouter and friends. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
