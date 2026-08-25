import type { ReactNode } from "react";

/**
 * التخطيط الجذري لا يرسم <html> — ذلك من مسؤولية تخطيط اللغة،
 * لأن سمتَي lang و dir لا تُعرفان إلا بعد تحديد اللغة من المسار.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
