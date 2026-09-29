// Optional email delivery via SMTP. If SMTP is not configured,
// the invite email is logged to the console (simulated) so the
// invitation link still reaches the resident in the UI.

export async function sendInviteEmail({ to, guestName, hostName, inviteUrl, message }) {
  const subject = `${hostName} has invited you to visit`;
  const body = [
    `Hi ${guestName},`,
    ``,
    `${hostName} has invited you to visit them at the hostel.`,
    ``,
    `Open your invitation to accept it (you'll take a selfie and photograph your ID):`,
    `${inviteUrl}`,
  ];
  if (message) {
    body.push(``, `Message from ${hostName}:`, message);
  }
  body.push(``, `Please bring a valid ID when you arrive.`);

  if (!process.env.SMTP_HOST) {
    // Simulated email (no SMTP configured)
    console.log('\n===== SIMULATED INVITE EMAIL (SMTP not configured) =====');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body.join('\n')}`);
    console.log('=========================================================\n');
    return { sent: false, simulated: true };
  }

  try {
    const nodemailer = (await import('nodemailer')).default;
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: body.join('\n'),
    });
    return { sent: true, simulated: false };
  } catch (err) {
    console.error('Failed to send invite email:', err.message);
    return { sent: false, simulated: false, error: err.message };
  }
}
