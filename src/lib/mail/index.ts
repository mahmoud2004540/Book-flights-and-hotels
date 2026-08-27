import { renderTemplate, type MailTemplate } from "./templates";

/**
 * Email delivery.
 *
 * Resend is used when RESEND_API_KEY is present. Without a key, development
 * prints the message — including the link — to the server console so the flow
 * can be exercised end to end, while production refuses to run silently:
 * an unsent verification email is a broken sign-up, not a warning.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendMail(
  to: string,
  template: MailTemplate,
): Promise<SendResult> {
  const { subject, html, text } = renderTemplate(template);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Rehlaty <no-reply@example.com>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "RESEND_API_KEY is not set — refusing to drop mail in production.",
      };
    }
    console.info(
      `\n─── email (dev, not sent) ───\nTo: ${to}\nSubject: ${subject}\n\n${text}\n─────────────────────────────\n`,
    );
    return { ok: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Resend responded ${response.status}: ${body}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown transport error",
    };
  }
}
