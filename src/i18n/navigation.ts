import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** بدائل واعية باللغة لـ Link و useRouter وغيرهما. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
