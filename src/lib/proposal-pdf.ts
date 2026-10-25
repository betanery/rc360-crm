import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ProposalTemplate = "entrada" | "executiva" | "estrategica";

export interface TitledItem {
  title: string;
  text: string;
}
export interface DeliverableRow {
  name: string;
  qty: string;
  criteria: string;
}
export interface KeyValue {
  label: string;
  value: string;
}
export interface ComponentRow {
  name: string;
  value: number | null;
}

export interface ProposalContent {
  number: string;
  date: string; // ISO yyyy-mm-dd
  validUntil: string; // ISO yyyy-mm-dd ou ""
  clientName: string;
  company: string;
  decisionMaker: string;
  headline: string;
  program: string;
  subtitle: string;
  introTitle: string;
  intro: string;
  included: TitledItem[];
  challenges: TitledItem[];
  stakes: string;
  priority: string;
  objective: string;
  momento: string;
  centralChallenge: string;
  desiredTraits: string;
  objectives: TitledItem[];
  fronts: TitledItem[];
  deliverables: DeliverableRow[];
  terms: KeyValue[];
  conditions: string;
  impact: KeyValue[];
  components: ComponentRow[];
  referencePrice: number | null;
  price: number;
  cash: string;
  installments: string;
  payment: string;
  firstDue: string;
  special: string;
  startCondition: string;
  priceNote: string;
  // Assinatura do PDF (vem do perfil de quem envia). Em branco: assinatura padrão.
  signerName?: string;
  signerTitle?: string;
}

// Identidade visual RC360 (Manual de Identidade Visual, set/2026).
type RGB = [number, number, number];
const NAVY: RGB = [6, 16, 29];
const GOLD: RGB = [212, 175, 55];
const IVORY: RGB = [248, 246, 238];
const GRAPHITE: RGB = [58, 58, 58];
const MUTED: RGB = [122, 122, 122];
const LINE: RGB = [232, 228, 216];
const WHITE: RGB = [255, 255, 255];

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 20;
const MR = 20;
const CONTENT_W = PAGE_W - ML - MR;
const TOP = 36;
const BOTTOM = 274;

const SERIF = "PlayfairDisplay";
const SANS = "Montserrat";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(value: number) {
  return money.format(value).replace(/\u00a0/g, " ");
}

export function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

const TEMPLATE_LABEL: Record<ProposalTemplate, string> = {
  entrada: "PROPOSTA PERSONALIZADA",
  executiva: "PROPOSTA EXECUTIVA",
  estrategica: "PROPOSTA ESTRATÉGICA PERSONALIZADA",
};

// ---------- carregamento de fontes e imagens (sob demanda) ----------

const assetCache = new Map<string, Promise<string>>();

function loadAsBase64(url: string, asDataUrl: boolean): Promise<string> {
  const key = `${asDataUrl ? "d" : "b"}:${url}`;
  let cached = assetCache.get(key);
  if (!cached) {
    cached = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Não foi possível carregar ${url}`);
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = String(reader.result);
              resolve(asDataUrl ? result : result.slice(result.indexOf(",") + 1));
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
    assetCache.set(key, cached);
  }
  return cached;
}

async function registerFonts(doc: jsPDF) {
  const [serifBold, sansRegular, sansSemi] = await Promise.all([
    loadAsBase64("/fonts/PlayfairDisplay-Bold.ttf", false),
    loadAsBase64("/fonts/Montserrat-Regular.ttf", false),
    loadAsBase64("/fonts/Montserrat-SemiBold.ttf", false),
  ]);
  doc.addFileToVFS("PlayfairDisplay-Bold.ttf", serifBold);
  doc.addFont("PlayfairDisplay-Bold.ttf", SERIF, "bold");
  doc.addFileToVFS("Montserrat-Regular.ttf", sansRegular);
  doc.addFont("Montserrat-Regular.ttf", SANS, "normal");
  doc.addFileToVFS("Montserrat-SemiBold.ttf", sansSemi);
  doc.addFont("Montserrat-SemiBold.ttf", SANS, "bold");
}

// ---------- gerador ----------

export async function buildProposalPdf(
  template: ProposalTemplate,
  c: ProposalContent,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await registerFonts(doc);
  const [markImg, logoImg] = await Promise.all([
    loadAsBase64("/logo-mark.png", true),
    loadAsBase64("/logo-horizontal.png", true),
  ]);

  let y = TOP;
  let sectionNo = 0;

  const fill = (rgb: RGB) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const stroke = (rgb: RGB) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const ink = (rgb: RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const font = (family: string, style: "normal" | "bold", size: number) => {
    doc.setFont(family, style);
    doc.setFontSize(size);
  };

  function star(cx: number, cy: number, r: number, rgb: RGB = GOLD) {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : r * 0.42;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    const first = pts[0]!;
    const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i]![0], p[1] - pts[i]![1]]);
    fill(rgb);
    doc.lines(deltas, first[0], first[1], [1, 1], "F", true);
  }

  function paintPage() {
    fill(IVORY);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  function newPage() {
    doc.addPage();
    paintPage();
    y = TOP;
  }

  function ensure(height: number) {
    if (y + height > BOTTOM) newPage();
  }

  function lines(text: string, width: number) {
    return doc.splitTextToSize(text, width) as string[];
  }

  // ----- blocos de texto -----

  function paragraph(
    text: string,
    opts: { size?: number; color?: RGB; indent?: number; bold?: boolean; gap?: number } = {},
  ) {
    const clean = text.trim();
    if (!clean) return;
    const size = opts.size ?? 9.5;
    const indent = opts.indent ?? 0;
    font(SANS, opts.bold ? "bold" : "normal", size);
    ink(opts.color ?? GRAPHITE);
    const lineH = size * 0.5;
    for (const block of clean.split(/\n+/)) {
      for (const line of lines(block, CONTENT_W - indent)) {
        ensure(lineH);
        doc.text(line, ML + indent, y);
        y += lineH;
      }
      y += lineH * 0.35;
    }
    y += opts.gap ?? 1.5;
  }

  function tag(text: string) {
    ensure(34);
    font(SANS, "bold", 7.5);
    ink(GOLD);
    doc.text(text, ML, y, { charSpace: 1.2 });
    y += 10;
  }

  function title(text: string, size = 19) {
    font(SERIF, "bold", size);
    ink(NAVY);
    const lh = size * 0.46;
    for (const line of lines(text, CONTENT_W)) {
      ensure(lh);
      doc.text(line, ML, y);
      y += lh;
    }
    y += 3.5;
  }

  function section(label: string, heading: string) {
    sectionNo += 1;
    if (y > TOP + 2) {
      y += 9;
      ensure(50);
    }
    tag(`${String(sectionNo).padStart(2, "0")}. ${label}`);
    title(heading);
  }

  function subhead(text: string) {
    ensure(14);
    y += 2;
    font(SANS, "bold", 10);
    ink(NAVY);
    doc.text(text, ML, y);
    y += 2;
    stroke(GOLD);
    doc.setLineWidth(0.4);
    doc.line(ML, y, ML + 12, y);
    y += 5;
  }

  function numbered(items: TitledItem[], digits = true) {
    items.forEach((item, index) => {
      font(SANS, "normal", 9.5);
      const bodyLines = item.text.trim()
        ? lines(item.text.trim(), CONTENT_W - (digits ? 12 : 0))
        : [];
      ensure(10 + bodyLines.length * 4.8);
      font(SERIF, "bold", 12);
      ink(GOLD);
      if (digits) doc.text(String(index + 1).padStart(2, "0"), ML, y);
      font(SANS, "bold", 10);
      ink(NAVY);
      doc.text(item.title, ML + (digits ? 12 : 0), y);
      y += 5;
      if (bodyLines.length) {
        font(SANS, "normal", 9.5);
        ink(GRAPHITE);
        for (const line of bodyLines) {
          ensure(4.8);
          doc.text(line, ML + (digits ? 12 : 0), y);
          y += 4.8;
        }
      }
      y += 4;
    });
  }

  function keyValues(rows: KeyValue[]) {
    for (const row of rows.filter((r) => r.value.trim())) {
      font(SANS, "normal", 9.5);
      const valueLines = lines(row.value.trim(), CONTENT_W - 48);
      ensure(valueLines.length * 4.8 + 2);
      font(SANS, "bold", 9.5);
      ink(NAVY);
      doc.text(`${row.label}`, ML, y);
      font(SANS, "normal", 9.5);
      ink(GRAPHITE);
      for (const line of valueLines) {
        doc.text(line, ML + 48, y);
        y += 4.8;
      }
      y += 1.2;
    }
    y += 2;
  }

  function bullets(items: string[]) {
    for (const item of items) {
      font(SANS, "normal", 9.5);
      const textLines = lines(item, CONTENT_W - 8);
      ensure(textLines.length * 4.8 + 1);
      fill(GOLD);
      doc.rect(ML + 1, y - 2.1, 1.6, 1.6, "F");
      font(SANS, "normal", 9.5);
      ink(GRAPHITE);
      for (const line of textLines) {
        doc.text(line, ML + 7, y);
        y += 4.8;
      }
      y += 1;
    }
    y += 2;
  }

  function note(text: string) {
    if (!text.trim()) return;
    paragraph(text, { size: 8, color: MUTED });
  }

  function table(head: string[], body: string[][], widths: number[], alignRight: number[] = []) {
    if (!body.length) return;
    const startPage = doc.getNumberOfPages();
    ensure(24);
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      margin: { left: ML, right: MR, top: TOP, bottom: PAGE_H - BOTTOM },
      theme: "plain",
      styles: {
        font: SANS,
        fontSize: 9,
        textColor: GRAPHITE,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineColor: LINE,
        lineWidth: 0,
      },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fillColor: WHITE },
      alternateRowStyles: { fillColor: IVORY },
      columnStyles: Object.fromEntries(
        widths.map((w, i) => [
          i,
          { cellWidth: w, ...(alignRight.includes(i) ? { halign: "right" as const } : {}) },
        ]),
      ),
      didParseCell: (data) => {
        if (data.section === "body") {
          data.cell.styles.lineWidth = { bottom: 0.2 };
          data.cell.styles.lineColor = [...LINE];
        }
      },
      willDrawPage: () => {
        if (doc.getCurrentPageInfo().pageNumber > startPage) paintPage();
      },
    });
    const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    y = (last?.finalY ?? y) + 6;
  }

  function priceBox(heading: string, programName: string) {
    const extra: string[] = [];
    if (c.cash.trim()) extra.push(`À vista: ${c.cash.trim()}`);
    if (c.installments.trim()) extra.push(`Parcelamento: ${c.installments.trim()}`);
    if (c.payment.trim()) extra.push(`Forma de pagamento: ${c.payment.trim()}`);
    if (c.firstDue.trim()) extra.push(`Primeiro vencimento: ${c.firstDue.trim()}`);
    if (c.special.trim()) extra.push(`Condição negociada: ${c.special.trim()}`);
    font(SANS, "normal", 9);
    const extraLines = extra.flatMap((e) => lines(e, CONTENT_W - 16));
    const boxH = 30 + (programName ? 6 : 0) + extraLines.length * 5 + (c.priceNote.trim() ? 8 : 0);
    ensure(boxH + 6);
    fill(NAVY);
    doc.roundedRect(ML, y, CONTENT_W, boxH, 2, 2, "F");
    let by = y + 9;
    font(SANS, "bold", 7.5);
    ink(GOLD);
    doc.text(heading.toUpperCase(), ML + 8, by, { charSpace: 1.2 });
    by += 4;
    if (programName) {
      by += 3;
      font(SANS, "normal", 9);
      ink(WHITE);
      doc.text(programName, ML + 8, by);
      by += 3;
    }
    by += 9;
    font(SERIF, "bold", 24);
    ink(GOLD);
    doc.text(formatMoney(c.price), ML + 8, by);
    by += 7;
    font(SANS, "normal", 9);
    ink(WHITE);
    for (const line of extraLines) {
      doc.text(line, ML + 8, by);
      by += 5;
    }
    if (c.priceNote.trim()) {
      font(SANS, "normal", 7.5);
      ink([200, 196, 184]);
      doc.text(lines(c.priceNote.trim(), CONTENT_W - 16).slice(0, 2), ML + 8, by + 1);
    }
    y += boxH + 6;
  }

  function steps(items: TitledItem[]) {
    numbered(items, true);
  }

  function closing(tagline?: string) {
    ensure(48);
    y += 4;
    star(PAGE_W / 2, y, 2.6);
    stroke(GOLD);
    doc.setLineWidth(0.3);
    doc.line(ML, y, PAGE_W / 2 - 6, y);
    doc.line(PAGE_W / 2 + 6, y, PAGE_W - MR, y);
    y += 12;
    font(SERIF, "bold", 13);
    ink(NAVY);
    doc.text(c.signerName?.trim() || "Roberta Cardoso", PAGE_W / 2, y, { align: "center" });
    y += 5.5;
    font(SANS, "normal", 8.5);
    ink(GRAPHITE);
    doc.text(
      c.signerTitle?.trim()
        ? `${c.signerTitle.trim()} | RC360 Desenvolvimento Empresarial`
        : "RC360 | Desenvolvimento Empresarial",
      PAGE_W / 2,
      y,
      { align: "center" },
    );
    y += 9;
    if (tagline) {
      font(SANS, "normal", 8.5);
      ink(MUTED);
      doc.text(tagline, PAGE_W / 2, y, { align: "center" });
      y += 6;
    }
    font(SERIF, "bold", 12);
    ink(GOLD);
    doc.text("O céu não é o limite.", PAGE_W / 2, y, { align: "center" });
    y += 6;
  }

  // ----- capa -----

  function cover() {
    fill(NAVY);
    doc.rect(0, 0, PAGE_W, PAGE_H, "F");

    // órbitas decorativas, só nos cantos (manual: traço leve, 0,5–1,5 pt)
    doc.setGState(doc.GState({ opacity: 0.35 }));
    stroke(GOLD);
    doc.setLineWidth(0.4);
    doc.circle(PAGE_W + 10, -5, 70, "S");
    doc.circle(PAGE_W + 10, -5, 82, "S");
    doc.circle(-10, PAGE_H + 5, 60, "S");
    doc.setGState(doc.GState({ opacity: 1 }));

    // marca (versão principal: dourado sobre navy)
    const markW = 34;
    doc.addImage(markImg, "PNG", (PAGE_W - markW) / 2, 30, markW, markW * (398 / 400));

    let cy = 82;
    font(SANS, "bold", 8);
    ink(GOLD);
    doc.text("DESENVOLVIMENTO EMPRESARIAL", PAGE_W / 2, cy, { align: "center", charSpace: 2 });
    cy += 24;
    font(SANS, "bold", 8);
    doc.text(TEMPLATE_LABEL[template], PAGE_W / 2, cy, { align: "center", charSpace: 1.6 });
    cy += 4;
    star(PAGE_W / 2, cy + 3, 2);
    cy += 16;

    const headline = c.headline.trim();
    if (headline) {
      font(SERIF, "bold", 24);
      ink(WHITE);
      const hl = lines(headline, 150);
      doc.text(hl, PAGE_W / 2, cy, { align: "center", lineHeightFactor: 1.25 });
      cy += hl.length * 11 + 6;
    }
    if (c.program.trim()) {
      font(SANS, "bold", 12);
      ink(GOLD);
      const pl = lines(c.program.trim(), 140);
      doc.text(pl, PAGE_W / 2, cy, { align: "center", lineHeightFactor: 1.4 });
      cy += pl.length * 6 + 4;
    }
    if (c.subtitle.trim()) {
      font(SANS, "normal", 9.5);
      ink([214, 210, 198]);
      const sl = lines(c.subtitle.trim(), 130);
      doc.text(sl, PAGE_W / 2, cy, { align: "center", lineHeightFactor: 1.5 });
    }

    const rows: [string, string][] =
      template === "entrada"
        ? [
            ["Preparado especialmente para", c.clientName],
            [
              "Proposta nº",
              c.number ? `${c.number}  |  ${formatDate(c.date)}` : formatDate(c.date),
            ],
          ]
        : template === "executiva"
          ? [
              ["Preparado para", c.clientName],
              ["Empresa", c.company],
              ["Proposta", c.number],
              ["Data", formatDate(c.date)],
            ]
          : [
              ["Preparada exclusivamente para", c.company || c.clientName],
              ["Aos cuidados de", c.decisionMaker],
              ["Proposta nº", c.number],
              ["Data", formatDate(c.date)],
            ];
    const shown = rows.filter(([, v]) => v.trim());
    let by = PAGE_H - 30 - shown.length * 9;
    stroke(GOLD);
    doc.setLineWidth(0.3);
    doc.line(ML + 15, by - 8, PAGE_W - MR - 15, by - 8);
    for (const [label, value] of shown) {
      font(SANS, "bold", 6.8);
      ink(GOLD);
      doc.text(label.toUpperCase(), PAGE_W / 2, by, { align: "center", charSpace: 1 });
      font(SANS, "normal", 10);
      ink(WHITE);
      doc.text(value, PAGE_W / 2, by + 4.6, { align: "center" });
      by += 9;
    }
  }

  // ----- templates -----

  const company = c.company.trim();
  const companyOf = company ? ` de ${company}` : "";

  function buildEntrada() {
    section("O VALOR DO AUTOCONHECIMENTO", c.introTitle.trim() || "Conhecer seu perfil");
    paragraph(c.intro);

    section("SUA EXPERIÊNCIA RC360", "O que está incluído");
    numbered(c.included.filter((i) => i.title.trim()));
    keyValues(c.terms);

    section(
      "SEU INVESTIMENTO",
      "Uma análise que pode mudar a forma como você compreende suas decisões e relacionamentos.",
    );
    if (c.referencePrice) {
      paragraph(
        `Valor de referência do serviço, quando aplicável: ${formatMoney(c.referencePrice)}`,
        {
          size: 9,
          color: MUTED,
        },
      );
    }
    priceBox("Investimento RC360", "");
    if (c.validUntil)
      paragraph(`Validade: ${formatDate(c.validUntil)}`, { bold: true, color: NAVY });

    section("PRÓXIMOS PASSOS", "Seu desenvolvimento começa com clareza sobre quem você é.");
    bullets([
      "1. Confirmar a contratação.",
      "2. Receber e responder o questionário.",
      "3. Agendar a devolutiva individual.",
      "4. Receber as orientações para aplicação prática.",
    ]);
    closing();
  }

  function buildExecutiva() {
    const challenges = c.challenges.filter((i) => i.title.trim());
    section("O PONTO DE PARTIDA", "O que está impedindo sua empresa de avançar?");
    paragraph(
      `Durante nossa conversa, identificamos oportunidades relevantes para melhorar a gestão e o desempenho${companyOf}.`,
    );
    if (challenges.length) {
      subhead("Principais desafios relatados");
      numbered(challenges);
    }
    if (c.stakes.trim()) paragraph(`Esses desafios merecem atenção porque ${c.stakes.trim()}`);
    if (c.priority.trim())
      paragraph(`Nossa prioridade: ${c.priority.trim()}`, { bold: true, color: NAVY });

    section("A SOLUÇÃO PROPOSTA", "Menos improviso. Mais direção e execução.");
    paragraph(
      `Para atender às necessidades identificadas, recomendamos o ${c.program.trim() || "projeto proposto"}${
        c.objective.trim() ? `, uma solução RC360 direcionada a ${c.objective.trim()}` : ""
      }.`,
    );
    paragraph(
      "O trabalho será desenvolvido de maneira objetiva, priorizando ações aplicáveis à realidade da empresa.",
    );
    const fronts = c.fronts.filter((i) => i.title.trim());
    if (fronts.length) {
      subhead("O que vamos desenvolver");
      numbered(fronts);
    }

    section("ENTREGÁVEIS E EXECUÇÃO", "O que será efetivamente entregue");
    table(
      ["ENTREGÁVEL", "DESCRIÇÃO / QUANTIDADE"],
      c.deliverables
        .filter((d) => d.name.trim())
        .map((d) => [d.name, [d.qty, d.criteria].filter((s) => s.trim()).join(" — ")]),
      [60, CONTENT_W - 60],
    );
    if (c.terms.some((t) => t.value.trim())) {
      subhead("Como acontecerá");
      keyValues(c.terms);
    }
    if (c.conditions.trim()) {
      subhead("Condições específicas do projeto");
      paragraph(c.conditions);
    }
    paragraph(
      "A RC360 conduzirá as atividades previstas. As ações operacionais internas permanecerão sob responsabilidade do cliente, exceto quando expressamente incluídas no escopo.",
      { size: 9, color: MUTED },
    );

    section("O VALOR DA SOLUÇÃO", "Quanto vale resolver o problema certo?");
    paragraph(
      "A questão não é apenas o custo da contratação, mas também o impacto de manter os desafios identificados sem tratamento.",
    );
    keyValues(c.impact);
    componentsTable(
      "Composição do investimento",
      "Componentes",
      "VALOR DE REFERÊNCIA",
      "Total de referência",
    );
    priceBox("Condição comercial RC360", "");

    section(
      "PRÓXIMOS PASSOS",
      "Sua empresa não precisa fazer tudo de uma vez. Precisa começar pelo que faz diferença.",
    );
    steps([
      { title: "Aprovar a proposta", text: "Validar escopo, entregáveis e investimento." },
      {
        title: "Formalizar a contratação",
        text: "Confirmar as condições comerciais e contratuais.",
      },
      { title: "Alinhar a execução", text: "Definir agenda, participantes e responsabilidades." },
      { title: "Iniciar o projeto", text: "Dar início às ações acordadas." },
    ]);
    if (c.validUntil)
      paragraph(`Validade da proposta: ${formatDate(c.validUntil)}`, { bold: true, color: NAVY });
    closing("O básico bem-feito gera resultados extraordinários.");
  }

  function componentsTable(heading: string, col1: string, col2: string, totalLabel: string) {
    const rows = c.components.filter((r) => r.name.trim() && r.value);
    if (!rows.length) return;
    subhead(heading);
    const total = rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
    table(
      [col1.toUpperCase(), col2],
      [...rows.map((r) => [r.name, formatMoney(r.value ?? 0)]), [totalLabel, formatMoney(total)]],
      [CONTENT_W - 50, 50],
      [1],
    );
    note(
      "Valores de referência exibidos somente quando houver preços avulsos efetivamente praticados ou parâmetros verificáveis.",
    );
  }

  function buildEstrategica() {
    const challenges = c.challenges.filter((i) => i.title.trim());
    section("O CENÁRIO ATUAL", "Todo novo nível de crescimento exige uma nova forma de gerir.");
    paragraph(
      `A partir da reunião realizada com ${c.clientName.trim() || "a liderança"}, compreendemos que ${
        company ? `a ${company}` : "a empresa"
      } está diante de um momento importante${c.momento.trim() ? ` de ${c.momento.trim()}` : ""}.`,
    );
    paragraph(
      "A empresa apresenta oportunidades de evolução que precisam ser tratadas com clareza estratégica e organização da execução.",
    );
    if (challenges.length) {
      subhead("Os desafios identificados");
      numbered(challenges);
    }
    if (c.stakes.trim()) {
      subhead("O que está em jogo");
      paragraph(c.stakes);
    }
    if (c.centralChallenge.trim()) paragraph(c.centralChallenge, { bold: true, color: NAVY });

    section("ONDE QUEREMOS CHEGAR", "Crescer com estrutura. Evoluir com direção.");
    paragraph(
      `O objetivo deste projeto é apoiar ${company ? `a ${company}` : "a empresa"} no desenvolvimento de uma gestão mais ${
        c.desiredTraits.trim() || "estruturada"
      }, fortalecendo a capacidade da organização de executar suas prioridades com consistência.`,
    );
    const objectives = c.objectives.filter((i) => i.title.trim());
    if (objectives.length) {
      subhead("Objetivos prioritários");
      numbered(objectives);
    }
    paragraph(
      "O trabalho buscará construir condições para que a empresa avance de forma sustentável, respeitando sua estrutura, recursos e capacidade de implementação.",
    );

    section(
      "NOSSA PROPOSTA DE TRANSFORMAÇÃO",
      "Uma visão integrada para resolver desafios que não acontecem isoladamente.",
    );
    paragraph(
      `A RC360 propõe o desenvolvimento do projeto ${c.program.trim() || "proposto"}, estruturado conforme as prioridades identificadas.`,
    );
    const fronts = c.fronts.filter((i) => i.title.trim() && i.text.trim());
    if (fronts.length) {
      subhead("Frentes de atuação contratadas");
      numbered(fronts, false);
    }

    section("OS ENTREGÁVEIS", "Compromissos claros. Entregas verificáveis.");
    table(
      ["Nº", "ENTREGÁVEL", "QTD.", "CRITÉRIO DE CONCLUSÃO"],
      c.deliverables
        .filter((d) => d.name.trim())
        .map((d, i) => [String(i + 1).padStart(2, "0"), d.name, d.qty, d.criteria]),
      [12, 54, 18, CONTENT_W - 84],
    );
    if (c.conditions.trim()) {
      subhead("Entregas e condições específicas negociadas");
      paragraph(c.conditions);
    }

    section("O CAMINHO DA EXECUÇÃO", "Diagnosticar. Priorizar. Estruturar. Orientar. Ajustar.");
    paragraph(
      "Nossa abordagem parte do entendimento da realidade da empresa e avança até a construção e o acompanhamento das melhorias acordadas.",
    );
    numbered([
      {
        title: "Diagnosticar",
        text: "Entender o cenário atual, identificar os principais desafios e validar informações relevantes.",
      },
      {
        title: "Priorizar",
        text: "Selecionar as oportunidades de maior impacto e estabelecer uma sequência viável de trabalho.",
      },
      {
        title: "Estruturar",
        text: "Desenvolver processos, ferramentas, rotinas, responsabilidades e direcionamentos previstos no escopo.",
      },
      {
        title: "Orientar",
        text: "Apoiar líderes e responsáveis internos na aplicação das soluções desenvolvidas.",
      },
      {
        title: "Ajustar",
        text: "Acompanhar os indicadores acordados, avaliar o andamento e orientar melhorias dentro do período contratado.",
      },
    ]);
    if (c.terms.some((t) => t.value.trim())) {
      subhead("Estrutura do programa");
      keyValues(c.terms);
    }

    section("RESPONSABILIDADES", "Uma transformação construída em conjunto.");
    subhead("A RC360 será responsável por");
    bullets([
      "Conduzir as atividades de diagnóstico previstas.",
      "Desenvolver as análises, orientações e entregáveis contratados.",
      "Realizar os encontros e acompanhamentos estabelecidos.",
      "Apresentar recomendações e ajustes pertinentes ao escopo.",
    ]);
    subhead("A empresa contratante será responsável por");
    bullets([
      "Disponibilizar informações e documentos necessários.",
      "Indicar responsáveis internos pelo projeto.",
      "Garantir a participação dos profissionais envolvidos.",
      "Executar as ações operacionais sob sua responsabilidade.",
      "Acompanhar as prioridades e decisões acordadas.",
    ]);
    paragraph(
      "O sucesso do projeto depende da colaboração entre as partes e da capacidade de implementar as ações definidas.",
      { size: 9, color: MUTED },
    );

    section(
      "O VALOR DO INVESTIMENTO",
      "O custo de manter tudo como está também precisa entrar na conta.",
    );
    paragraph(
      "Quando desafios estratégicos e operacionais permanecem sem tratamento, a empresa pode continuar consumindo recursos, tempo da liderança e oportunidades de crescimento.",
    );
    if (c.impact.some((r) => r.value.trim())) {
      subhead("Impacto econômico identificado");
      keyValues(c.impact);
      note(
        "Esta análise é exibida somente quando há dados suficientes para sustentar a estimativa.",
      );
    }
    paragraph(
      "A contratação proposta reúne competências, encontros e entregas em um trabalho coordenado, evitando a fragmentação do direcionamento empresarial.",
    );
    componentsTable(
      "O valor da solução integrada",
      "Componentes da solução",
      "VALOR AVULSO DE REFERÊNCIA",
      "Valor total de referência",
    );
    priceBox("Sua condição comercial RC360", c.program.trim());

    section(
      "CONDIÇÕES E PRÓXIMOS PASSOS",
      "O próximo nível começa com uma decisão e se constrói com execução.",
    );
    subhead("Condições da proposta");
    keyValues([
      { label: "Validade", value: c.validUntil ? formatDate(c.validUntil) : "" },
      { label: "Início", value: c.startCondition },
      { label: "Escopo", value: "limitado às atividades e entregas expressamente descritas." },
      {
        label: "Alterações",
        value:
          "serviços adicionais ou ampliações de escopo dependerão de negociação e aprovação específica.",
      },
      {
        label: "Confidencialidade",
        value:
          "o tratamento das informações empresariais observará as obrigações de confidencialidade previstas na contratação.",
      },
      {
        label: "Resultados",
        value:
          "a RC360 compromete-se com a execução dos serviços e entregáveis acordados. Os resultados empresariais dependerão também de fatores internos, externos e da implementação das recomendações.",
      },
      {
        label: "Formalização",
        value: "a aprovação comercial será seguida pelos instrumentos contratuais aplicáveis.",
      },
    ]);
    subhead("Quatro passos para começar");
    steps([
      { title: "Aprovar a proposta", text: "Confirmar a solução, as condições e os entregáveis." },
      {
        title: "Formalizar a contratação",
        text: "Concluir os documentos e procedimentos comerciais.",
      },
      {
        title: "Realizar o alinhamento inicial",
        text: "Definir agenda, responsáveis e informações necessárias.",
      },
      {
        title: "Iniciar o projeto",
        text: "Colocar em andamento as primeiras atividades previstas.",
      },
    ]);
    closing();
  }

  cover();
  newPage();
  if (template === "entrada") buildEntrada();
  else if (template === "executiva") buildExecutiva();
  else buildEstrategica();

  // cabeçalho e rodapé nas páginas internas
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page++) {
    doc.setPage(page);
    const logoW = 26;
    doc.addImage(logoImg, "PNG", ML, 11, logoW, logoW * (277 / 900));
    font(SANS, "normal", 7);
    ink(MUTED);
    doc.text(c.number ? `Proposta nº ${c.number}` : "Proposta RC360", PAGE_W - MR, 15, {
      align: "right",
    });
    stroke(GOLD);
    doc.setLineWidth(0.3);
    doc.line(ML, 24, PAGE_W - MR, 24);

    stroke(LINE);
    doc.setLineWidth(0.2);
    doc.line(ML, 283, PAGE_W - MR, 283);
    font(SANS, "normal", 7);
    ink(MUTED);
    doc.text("RC360 | Desenvolvimento Empresarial  ·  O céu não é o limite.", ML, 288);
    doc.text(`${page - 1} / ${total - 1}`, PAGE_W - MR, 288, { align: "right" });
  }

  return doc.output("blob");
}
