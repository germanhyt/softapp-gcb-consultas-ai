import nodemailer from "nodemailer";

interface EmailOptions {
  to: string[];
  subject: string;
  htmlContent: string;
  taskName: string;
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="color:#064e3b;margin:16px 0 8px;font-size:16px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="color:#064e3b;margin:20px 0 10px;font-size:18px;">$1</h2>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Tables
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match) => {
    const lines = match.trim().split("\n");
    if (lines.length < 3) return match;

    const headers = lines[0].split("|").filter((h) => h.trim()).map((h) => h.trim());
    const rows = lines.slice(2).map((row) =>
      row.split("|").filter((c) => c.trim()).map((c) => c.trim())
    );

    let table = '<table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:13px;">';
    table += "<thead><tr>";
    headers.forEach((h) => {
      table += `<th style="border:1px solid #d1d5db;padding:8px 12px;background:#ecfdf5;text-align:left;font-weight:600;">${h}</th>`;
    });
    table += "</tr></thead><tbody>";
    rows.forEach((row, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
      table += `<tr style="background:${bg};">`;
      row.forEach((cell) => {
        table += `<td style="border:1px solid #d1d5db;padding:6px 12px;">${cell}</td>`;
      });
      table += "</tr>";
    });
    table += "</tbody></table>";
    return table;
  });

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="padding-left:20px;margin:8px 0;">$1</ul>');

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

function buildEmailTemplate(content: string, taskName: string, model: string): string {
  const now = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });
  const bodyHtml = markdownToHtml(content);

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#047857);padding:24px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">El Refugio</h1>
            <p style="color:#a7f3d0;margin:4px 0 0;font-size:13px;">Reporte Automático</p>
          </td>
        </tr>
        <!-- Task name -->
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="color:#6b7280;font-size:12px;margin:0;">
              <strong>Tarea:</strong> ${taskName} · <strong>Generado:</strong> ${now} · <strong>Modelo:</strong> ${model}
            </p>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:16px 32px 32px;">
            <div style="font-size:14px;line-height:1.6;color:#1f2937;">
              ${bodyHtml}
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="color:#9ca3af;font-size:11px;margin:0;">
              Este reporte fue generado automáticamente por Consultas Refugio v2.
              <br>No responder a este correo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendReportEmail(options: EmailOptions & { model?: string }): Promise<boolean> {
  const { to, subject, htmlContent, taskName, model = "gemini-2.5-flash" } = options;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[EmailSender] SMTP not configured, skipping email");
    return false;
  }

  try {
    const transporter = getTransporter();
    const fullHtml = buildEmailTemplate(htmlContent, taskName, model);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to.join(", "),
      subject: `[El Refugio] ${subject}`,
      html: fullHtml,
    });

    console.log(`[EmailSender] Report sent to ${to.join(", ")}`);
    return true;
  } catch (error) {
    console.error("[EmailSender] Failed:", error);
    return false;
  }
}
