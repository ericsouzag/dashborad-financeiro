// Depende de pdf.js carregado globalmente via CDN no index.html
// (window.pdfjsLib). Ver <script> no final do <body>.

import { categorize } from "./categorize-rules.js";

/**
 * @param {File} file - PDF do boleto (pode ser protegido por senha)
 * @param {string} password
 * @returns {Promise<{transactions: Array, rawTotal: number}>}
 */
export async function parseC6Boleto(file, password) {
  const buffer = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({
    data: buffer,
    password,
  });

  const pdf = await loadingTask.promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    lines.push(...groupItemsIntoLines(content.items));
  }

  const transactions = extractTransactions(lines);
  const rawTotal = transactions.reduce((sum, t) => sum + t.amount, 0);

  return { transactions, rawTotal: Math.round(rawTotal * 100) / 100 };
}

// Agrupa os itens de texto do pdf.js em linhas, com base na coordenada Y.
function groupItemsIntoLines(items) {
  const rows = new Map();
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(item);
  }
  const sortedY = [...rows.keys()].sort((a, b) => b - a);
  return sortedY.map(y =>
    rows.get(y)
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map(i => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      // o boleto do C6 traz um quadradinho antes de cada transação
      .replace(/^[\u25a1\u2610\u2751\s]+/, "")
      .trim()
  );
}

// Ex. de linha real do boleto:
// "09 dez MERCADOLIVRE*PAULINHO - Parcela 9/9 55,44"
// "05 ago SHOPEE *SHPSTECNOLOGIA 38,70"
const TX_LINE = /^(\d{2}\s[a-zç]{3})\s+(.+?)\s+([\d.]+,\d{2})$/i;

function extractTransactions(lines) {
  const out = [];
  for (const line of lines) {
    const m = line.match(TX_LINE);
    if (!m) continue;
    const [, date, descRaw, amountStr] = m;
    // ignora linhas que na verdade são estornos/créditos com sinal
    let desc = descRaw.trim();
    const isEstorno = /estorno/i.test(desc);
    const amount = parseFloat(amountStr.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(amount)) continue;

    const installmentMatch = desc.match(/-\s*Parcela\s*(\d+)\/(\d+)/i);
    if (installmentMatch) desc = desc.replace(/-\s*Parcela\s*\d+\/\d+/i, "").trim();

    out.push({
      date,
      description: desc,
      installment: installmentMatch ? `${installmentMatch[1]}/${installmentMatch[2]}` : null,
      amount: isEstorno ? -Math.abs(amount) : amount,
      category: categorize(desc),
    });
  }
  return out;
}
