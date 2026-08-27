import { BRAND } from "@/lib/config";

/**
 * Transactional email templates — section 11.
 * Plain HTML with inline styles, because email clients strip <style> blocks
 * and support no CSS variables.
 */

export type MailTemplate =
  | { kind: "verifyEmail"; name: string | null; url: string }
  | { kind: "resetPassword"; url: string }
  | { kind: "passwordChanged" };

type Rendered = { subject: string; html: string; text: string };

const INK = "#111823";
const MUTED = "#54637a";
const BRAND_COLOR = "#a85d06";

function layout(heading: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f5f8;padding:32px 16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #cfd8e3;border-radius:8px;" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 32px 8px;">
  <p style="margin:0;font-size:15px;font-weight:600;color:${INK};">${BRAND.name}</p>
</td></tr>
<tr><td style="padding:8px 32px 0;">
  <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:${INK};font-weight:600;">${heading}</h1>
  <div style="font-size:15px;line-height:1.65;color:${MUTED};">${body}</div>
</td></tr>
${
  cta
    ? `<tr><td style="padding:24px 32px 8px;">
  <a href="${cta.url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:11px 22px;border-radius:6px;">${cta.label}</a>
</td></tr>
<tr><td style="padding:8px 32px 28px;">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#7a8798;">If the button does not work, paste this into your browser:<br><span style="word-break:break-all;">${cta.url}</span></p>
</td></tr>`
    : `<tr><td style="padding:0 32px 28px;"></td></tr>`
}
</table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#7a8798;">© ${new Date().getFullYear()} ${BRAND.name}</p>
</td></tr></table></body></html>`;
}

export function renderTemplate(template: MailTemplate): Rendered {
  switch (template.kind) {
    case "verifyEmail": {
      const greeting = template.name ? `Hi ${template.name},` : "Hi,";
      return {
        subject: `Confirm your email for ${BRAND.name}`,
        html: layout(
          "Confirm your email address",
          `<p style="margin:0 0 10px;">${greeting}</p>
           <p style="margin:0;">Confirm this address to finish setting up your account. The link is good for 24 hours.</p>`,
          { label: "Confirm email", url: template.url },
        ),
        text: `${greeting}\n\nConfirm your email to finish setting up your ${BRAND.name} account. The link is good for 24 hours.\n\n${template.url}`,
      };
    }

    case "resetPassword":
      return {
        subject: `Reset your ${BRAND.name} password`,
        html: layout(
          "Reset your password",
          `<p style="margin:0;">Use the button below to choose a new password. The link expires in one hour, and works once.</p>
           <p style="margin:12px 0 0;">If you did not ask for this, you can ignore this email — your password stays as it is.</p>`,
          { label: "Choose a new password", url: template.url },
        ),
        text: `Reset your ${BRAND.name} password. The link expires in one hour and works once.\n\n${template.url}\n\nIf you did not ask for this, ignore this email — your password stays as it is.`,
      };

    case "passwordChanged":
      return {
        subject: `Your ${BRAND.name} password was changed`,
        html: layout(
          "Your password was changed",
          `<p style="margin:0;">This is a confirmation that the password on your account has just been changed.</p>
           <p style="margin:12px 0 0;">If this was not you, reset your password immediately and contact us.</p>`,
        ),
        text: `Your ${BRAND.name} password was just changed.\n\nIf this was not you, reset your password immediately and contact us.`,
      };
  }
}
