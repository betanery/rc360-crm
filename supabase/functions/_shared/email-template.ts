// Template de e-mail transacional do RC360 CRM.
// Usa layout baseado em tabelas (não flex/grid) porque clientes de e-mail
// legados (Outlook em especial) só renderizam esse formato corretamente.
// Cores extraídas de src/styles.css para manter a mesma identidade do app.

const COLORS = {
  navy: "#132e50",
  navyText: "#f8f5ee",
  gold: "#cba553",
  goldText: "#0e2036",
  ivory: "#f9f6ed",
  card: "#fcfaf4",
  charcoal: "#212730",
  muted: "#6b7280",
  border: "#e6e1d6",
};

export interface EmailContent {
  heading: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmailHtml({ heading, bodyText, ctaLabel, ctaUrl }: EmailContent): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${COLORS.charcoal};">${escapeHtml(
          block,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const cta =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding:8px 0 0 0;">
           <a href="${ctaUrl}" style="display:inline-block;background:${COLORS.navy};color:${COLORS.navyText};text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">${escapeHtml(
             ctaLabel,
           )}</a>
         </td></tr>`
      : "";

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.ivory};font-family:'Work Sans',Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.ivory};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};">
            <tr>
              <td style="background:${COLORS.navy};padding:24px 32px;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${COLORS.navyText};">RC360</span>
                <span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:${COLORS.gold};text-transform:uppercase;margin-left:6px;">CRM</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${COLORS.charcoal};">${escapeHtml(
                  heading,
                )}</h1>
                ${paragraphs}
                <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};">
                <p style="margin:0;font-size:12px;color:${COLORS.muted};">
                  Enviado por RC360 — esta é uma comunicação relacionada ao seu contato com a RC360.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderEmailText({ heading, bodyText, ctaLabel, ctaUrl }: EmailContent): string {
  const cta = ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : "";
  return `${heading}\n\n${bodyText}${cta}\n\n—\nEnviado por RC360.`;
}
