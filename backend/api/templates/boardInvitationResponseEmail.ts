type BoardInvitationResponseEmailParams = {
  appName?: string;
  recipientName?: string;
  inviteeName: string;
  boardName: string;
  decision: 'accepted' | 'declined';
};

export function boardInvitationResponseEmailTemplate({
  appName = 'Fluely',
  recipientName,
  inviteeName,
  boardName,
  decision
}: BoardInvitationResponseEmailParams) {
  const safeRecipient = recipientName?.trim();
  const verb = decision === 'accepted' ? 'accepted' : 'declined';
  const title = `${inviteeName} ${verb} your invitation to ${boardName}`;

  const text =
    `${safeRecipient ? `Hi ${safeRecipient},` : 'Hi,'}\n\n` +
    `${inviteeName} ${verb} your invitation to collaborate on the board "${boardName}".\n\n` +
    (decision === 'accepted'
      ? `They now have access — open "${boardName}" in ${appName} to work together.\n\n`
      : `You can invite them again from the board's share menu at any time.\n\n`) +
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
          <strong>${inviteeName}</strong> ${verb} your invitation to collaborate on
          <strong>${boardName}</strong>.
        </div>

        <div style="margin-top:10px;font-size:14px;color:#374151;line-height:1.5;">
          ${
            decision === 'accepted'
              ? 'They now have access — open the board in ' + appName + ' to work together.'
              : 'You can invite them again from the board&#39;s share menu at any time.'
          }
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
