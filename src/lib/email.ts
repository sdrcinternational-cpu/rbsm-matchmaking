// Sends email through Resend's HTTP API. Without RESEND_API_KEY, emails are logged instead,
// which is what local development uses (login codes appear in the terminal).

export async function sendEmail(to: string | string[], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const recipients = Array.isArray(to) ? to : [to];
  if (!recipients.length) return;
  if (!key) {
    console.log(`\n[email] to=${recipients.join(",")}\nsubject: ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "RBSM Connect <onboarding@resend.dev>",
      to: recipients,
      subject,
      text,
    }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text());
}

export function appUrl(path = "") {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "") + path;
}
