import type { APIRoute } from 'astro';
import { getCfEnv } from '../../../lib/cf-env';
import { Resend } from 'resend';
import { generateId } from '../../../lib/utils';

export const POST: APIRoute = async ({ request }) => {
  const { DB: db } = await getCfEnv();
  const body = await request.json();
  const { company_id, to_email, subject, body: emailBody } = body;

  if (!to_email || !subject || !emailBody) {
    return new Response(JSON.stringify({ error: 'Missing required fields: to_email, subject, body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!company_id) {
    return new Response(JSON.stringify({ error: 'Missing required field: company_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to_email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = ((await getCfEnv()).RESEND_API_KEY as string) ?? '';
  const senderEmail = ((await getCfEnv()).SENDER_EMAIL as string) ?? 'noreply@example.com';
  const senderName = ((await getCfEnv()).SENDER_NAME as string) ?? 'Prospect Tracker';

  let emailStatus: 'sent' | 'failed' = 'sent';
  let error: string | null = null;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: [to_email],
      subject,
      text: emailBody,
    });
  } catch (e: any) {
    emailStatus = 'failed';
    error = e.message || 'Failed to send email';
  }

  // Log the email
  const logId = generateId();
  await db.prepare(`
    INSERT INTO email_log (id, company_id, to_email, subject, body, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(logId, company_id, to_email, subject, emailBody, emailStatus).run();

  // Create auto-note
  if (emailStatus === 'sent') {
    await db.prepare(`
      INSERT INTO notes (id, company_id, body) VALUES (?, ?, ?)
    `).bind(generateId(), company_id, `Email sent to ${to_email}: "${subject}"`).run();

    // Update company updated_at
    await db.prepare(`UPDATE companies SET updated_at = datetime('now') WHERE id = ?`).bind(company_id).run();
  }

  if (emailStatus === 'failed') {
    return new Response(JSON.stringify({ error: error || 'Failed to send' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: logId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
