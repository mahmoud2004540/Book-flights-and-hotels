import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * توجيه اللغة. Next 16 سمّى هذه الطبقة proxy بدل middleware.
 */
export default createMiddleware(routing);

export const config = {
  // كل المسارات ما عدا نقاط الـ API والأصول الثابتة والملفات ذات الامتداد.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
