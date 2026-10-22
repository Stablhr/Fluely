/**
 * Shared, branded email layout for Fluely transactional mail.
 *
 * Every template (invitations, mentions, password reset) renders through
 * `renderEmailLayout` so the chrome -- logo, palette, footer, dark-mode-safe
 * inline CSS -- stays consistent. The body is supplied as already-escaped
 * HTML fragments; callers are responsible for escaping user-controlled values.
 */

export type EmailLayoutParams = {
  /** Page title, also used for the <title> tag. */
  title: string;
  /** Pre-rendered HTML for the message body. */
  bodyHtml: string;
  /** Pre-rendered plain-text body. */
  bodyText: string;
  /** Optional call-to-action button. */
  cta?: {label: string; url: string};
  /** Optional expiry note rendered under the button. */
  expiryNote?: string;
  /** Optional footer override. */
  footer?: string;
  appName?: string;
};

const BRAND = {
  celticBlue: '#3971b8',
  ivory: '#fbfcee',
  teaGreen: '#c8d69b',
  vanilla: '#f6e6a5',
  drab: '#343b1b'
};

export function renderEmailLayout(params: EmailLayoutParams): {subject: string; text: string; html: string} {
  const appName = params.appName ?? 'Fluely';
  const footer =
    params.footer ??
    "If you weren't expecting this, you can ignore this email. " +
      `Questions? Contact support@fluely.app.`;

  const ctaHtml = params.cta
    ? `<div style="margin:24px 0;text-align:center;">
        <a href="${params.cta.url}" style="display:inline-block;padding:12px 28px;border-radius:9999px;background:${BRAND.celticBlue};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${params.cta.label}</a>
      </div>
      ${params.cta.url ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280;line-height:1.5;word-break:break-all;">Or copy and paste this link into your browser:<br /><a href="${params.cta.url}" style="color:${BRAND.celticBlue};">${params.cta.url}</a></p>` : ''}`
    : '';

  const expiryHtml = params.expiryNote
    ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">${params.expiryNote}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${params.title}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.ivory};font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="text-align:center;margin-bottom:16px;">
        <span style="font-size:22px;font-weight:800;color:${BRAND.celticBlue};letter-spacing:-0.02em;">${appName}</span>
      </div>
      <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e7eaf2;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${params.title}</h1>
        <div style="font-size:14px;color:#374151;line-height:1.6;">
          ${params.bodyHtml}
        </div>
        ${ctaHtml}
        ${expiryHtml}
      </div>
      <div style="margin-top:16px;text-align:center;font-size:12px;color:#6b7280;line-height:1.5;">
        ${footer}<br />
        &copy; ${new Date().getFullYear()} ${appName}
      </div>
    </div>
  </body>
</html>`;

  const text = `${params.title}\n\n${params.bodyText}\n\n${params.cta ? `${params.cta.label}: ${params.cta.url}\n\n` : ''}${params.expiryNote ? params.expiryNote + '\n\n' : ''}${footer}`;

  return {subject: params.title, text, html};
}

export type InviteEmailParams = {
  appName?: string;
  recipientName?: string;
  inviterName: string;
  boardName: string;
  role: 'editor' | 'viewer';
  acceptUrl: string;
  expiresAt: Date;
};

export function renderInviteEmail(params: InviteEmailParams) {
  const safeRecipient = params.recipientName?.trim();
  const roleLabel = params.role === 'editor' ? 'Editor' : 'Viewer';
  const roleExplanation =
    params.role === 'editor'
      ? 'Editors can create, edit, and move cards on this board.'
      : 'Viewers can view the board and its cards but cannot make changes.';

  const title = `${params.inviterName} invited you to collaborate on "${params.boardName}" on Fluely`;

  const bodyHtml = `
    ${safeRecipient ? `<p style="margin:0 0 10px;">Hi ${safeRecipient},</p>` : ''}
    <p style="margin:0 0 10px;">
      <strong>${params.inviterName}</strong> invited you to join
      <strong>${params.boardName}</strong> as an <strong>${roleLabel}</strong>.
    </p>
    <p style="margin:0 0 10px;color:#6b7280;">${roleExplanation}</p>
  `;

  const bodyText =
    `${safeRecipient ? `Hi ${safeRecipient},\n\n` : ''}` +
    `${params.inviterName} invited you to join "${params.boardName}" as ${params.role}.\n` +
    `${roleExplanation}\n\n` +
    `Accept the invitation: ${params.acceptUrl}\n`;

  const expires = params.expiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return renderEmailLayout({
    appName: params.appName,
    title,
    bodyHtml,
    bodyText,
    cta: {label: 'Accept invitation', url: params.acceptUrl},
    expiryNote: `This invitation expires on ${expires}.`,
    footer: "If you weren't expecting this, you can ignore this email."
  });
}

// Backwards-compatible alias used by the existing notification service.
export function boardInvitationEmailTemplate(params: {
  appName?: string;
  recipientName?: string;
  inviterName: string;
  boardName: string;
  role: 'editor' | 'viewer';
}) {
  return renderInviteEmail({
    appName: params.appName,
    recipientName: params.recipientName,
    inviterName: params.inviterName,
    boardName: params.boardName,
    role: params.role,
    acceptUrl: '#',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
}