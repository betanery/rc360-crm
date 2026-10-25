// Template de e-mail do RC360 CRM.
// Usa layout baseado em tabelas (não flex/grid) porque clientes de e-mail
// legados (Outlook em especial) só renderizam esse formato corretamente.
// Cores extraídas de src/styles.css para manter a mesma identidade do app.
//
// Este arquivo não usa nada específico do Deno de propósito: a tela de
// Conteúdos importa o mesmo código para a pré-visualização ser idêntica ao
// e-mail real.
//
// Texto do corpo: parágrafos separados por linha em branco; **negrito**;
// [texto](https://link); listas com "- " no início de cada linha.
// Sem imagens nem rastreamento de propósito (melhor entrega na caixa de
// entrada).

const COLORS = {
  navy: "#06101D",
  navyText: "#F8F6EE",
  gold: "#D4AF37",
  goldText: "#06101D",
  ivory: "#F8F6EE",
  card: "#FCFBF7",
  charcoal: "#3A3A3A",
  muted: "#7A7A7A",
  border: "#E8E4D8",
};

export interface EmailContent {
  heading: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  // Texto curto que aparece ao lado do assunto na caixa de entrada.
  preheader?: string;
  // E-mail de marketing/conteúdo: mostra rodapé de identidade e descadastro.
  unsubscribeUrl?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const isHttpUrl = (url: string) => /^https?:\/\/[^\s"<>]+$/i.test(url);

// Aplica negrito e links em um texto que ainda não foi escapado.
function formatInline(raw: string) {
  const links: string[] = [];
  // Protege os links antes de escapar, para a URL não ser alterada.
  const withTokens = raw.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    if (!isHttpUrl(url)) return match;
    links.push(
      `<a href="${escapeHtml(url)}" style="color:${COLORS.navy};font-weight:600;text-decoration:underline;">${escapeHtml(label)}</a>`,
    );
    return `\u0000${links.length - 1}\u0000`;
  });
  return escapeHtml(withTokens)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\u0000(\d+)\u0000/g, (_m, index) => links[Number(index)] ?? "");
}

const paragraphStyle = `margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${COLORS.charcoal};`;

function renderBody(bodyText: string) {
  return bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^\s*-\s+/.test(line))) {
        const items = lines
          .map(
            (line) =>
              `<li style="margin:0 0 6px 0;">${formatInline(line.replace(/^\s*-\s+/, ""))}</li>`,
          )
          .join("");
        return `<ul style="${paragraphStyle}padding-left:20px;">${items}</ul>`;
      }
      return `<p style="${paragraphStyle}">${formatInline(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function renderEmailHtml({
  heading,
  bodyText,
  ctaLabel,
  ctaUrl,
  preheader,
  unsubscribeUrl,
}: EmailContent): string {
  const marketing = Boolean(unsubscribeUrl);
  const cta =
    ctaLabel && ctaUrl && isHttpUrl(ctaUrl)
      ? `<tr><td style="padding:8px 0 0 0;">
           <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${COLORS.navy};color:${COLORS.navyText};text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">${escapeHtml(
             ctaLabel,
           )}</a>
         </td></tr>`
      : "";

  const hidden = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
        preheader,
      )}</div>`
    : "";

  const footer = marketing
    ? `<p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${COLORS.muted};">
         Você recebeu este e-mail porque se cadastrou na RC360 — Desenvolvimento Empresarial,
         de Roberta Cardoso. Se preferir não receber mais, é só
         <a href="${escapeHtml(unsubscribeUrl!)}" style="color:${COLORS.muted};text-decoration:underline;">cancelar a inscrição</a>.
       </p>`
    : `<p style="margin:0;font-size:12px;color:${COLORS.muted};">
         Enviado por RC360 — esta é uma comunicação relacionada ao seu contato com a RC360.
       </p>`;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.ivory};font-family:'Montserrat',Arial,Helvetica,sans-serif;">
    ${hidden}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.ivory};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};">
            <tr>
              <td style="background:${COLORS.navy};padding:24px 32px;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${COLORS.navyText};">RC360</span>
                ${
                  marketing
                    ? `<span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:${COLORS.gold};text-transform:uppercase;margin-left:8px;">Desenvolvimento Empresarial</span>`
                    : `<span style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:${COLORS.gold};text-transform:uppercase;margin-left:6px;">CRM</span>`
                }
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.navy};">${escapeHtml(
                  heading,
                )}</h1>
                ${renderBody(bodyText)}
                <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Remove a marcação do texto simples (negrito e links) para a versão texto.
function stripMarkup(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*(.+?)\*\*/g, "$1");
}

export function renderEmailText({
  heading,
  bodyText,
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
}: EmailContent): string {
  const cta = ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : "";
  const footer = unsubscribeUrl
    ? `—\nRC360 — Desenvolvimento Empresarial (Roberta Cardoso).\nPara não receber mais, cancele a inscrição: ${unsubscribeUrl}`
    : "—\nEnviado por RC360.";
  return `${heading}\n\n${stripMarkup(bodyText)}${cta}\n\n${footer}`;
}
