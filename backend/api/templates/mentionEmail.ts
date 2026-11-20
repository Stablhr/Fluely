import {renderEmailLayout} from './boardInvitationEmail';

export type MentionEmailParams = {
  appName?: string;
  recipientName?: string;
  actorName: string;
  boardName: string;
  /** Comment excerpt; user-controlled, escaped here. */
  snippet: string;
  boardUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Someone mentioned you in a comment" -- sent when `email.mentions` is on. */
export function mentionEmailTemplate(params: MentionEmailParams) {
  const recipient = params.recipientName?.trim();
  const title = `${params.actorName} mentioned you on "${params.boardName}"`;

  const bodyHtml = `
    ${recipient ? `<p style="margin:0 0 10px;">Hi ${escapeHtml(recipient)},</p>` : ''}
    <p style="margin:0 0 10px;">
      <strong>${escapeHtml(params.actorName)}</strong> mentioned you in a comment on
      <strong>${escapeHtml(params.boardName)}</strong>:
    </p>
    <blockquote style="margin:0 0 10px;padding:8px 12px;border-left:3px solid #e5e7eb;color:#374151;">
      ${escapeHtml(params.snippet)}
    </blockquote>
  `;

  const bodyText =
    `${recipient ? `Hi ${recipient},\n\n` : ''}` +
    `${params.actorName} mentioned you in a comment on "${params.boardName}":\n\n` +
    `"${params.snippet}"\n`;

  const footer = 'You can turn off mention emails in your notification settings.';
  // The layout drops the title into the HTML as-is, so hand it an escaped copy
  // and keep the raw one for the subject and plain-text body.
  const rendered = renderEmailLayout({
    appName: params.appName,
    title: escapeHtml(title),
    bodyHtml,
    bodyText,
    cta: {label: 'Open board', url: params.boardUrl},
    footer
  });
  return {
    subject: title,
    text: `${title}\n\n${bodyText}\nOpen board: ${params.boardUrl}\n\n${footer}`,
    html: rendered.html
  };
}
