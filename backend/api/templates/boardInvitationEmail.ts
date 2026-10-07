type BoardInvitationEmailParams = {
  appName?: string;
  recipientName?: string;
  inviterName: string;
  boardName: string;
  role: 'editor' | 'viewer';
};

export function boardInvitationEmailTemplate({
  appName = 'Fluely',
  recipientName,
  inviterName,
  boardName,
  role
}: BoardInvitationEmailParams) {
  const safeRecipient = recipientName?.trim();
  const title = `${inviterName} invited you to ${boardName}`;

  const text =
    `${safeRecipient ? `Hi ${safeRecipient},` : 'Hi,'}\n\n` +
    `${inviterName} invited you to collaborate on the board "${boardName}" as ${role}.\n\n` +
    `Sign in to ${appName} and open the bell in the top bar to accept or decline.\n\n` +
    `Thanks,\n` +
    `The ${appName} Team`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:14px;padding:24;border:1px solid #e7eaf2;">
        <div style="font-size:18px;font-weight:700;color:#111827;">${appName}</div>
        <div style="margin-top:12px;font-size:14px;color:#374151;line-height:1.5;">
          ${safeRecipient ? `Hi ${safeRecipient},` : 'Hi,'}
        </div>
        <div style="margin-top:10px;font-size:14px;color:#374151;line-height:1.5;">
          <strong>${inviterName}</strong> invited you to collaborate on
          <strong>${boardName}</strong> as ${role}.
        </div>

        <div style="margin:18px 0;text-align:center;">
          <a href="#" style="display:inline-block;padding:10px 20px;border-radius:10px;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Open ${appName}</a>
        </div>

        <div style="font-size:13px;color:#6b7280;line-height:1.5;">
          Sign in and open the bell in the top bar to accept or decline this invitation.
        </div>

        <div style="margin-top:14px;font-size:13px;color:#6b7280;line-height:1.5;">
          Thanks,<br />
          The ${appName} Team
        </div>
      </div>
      <div style="margin-top:14px;text-align:center;font-size:12px;color:#9ca3af;">
        &copy; ${new Date().getFullYear()} ${appName}
      </div>
    </div>
  </body>
</html>`;

  return {subject: title, text, html};
}
