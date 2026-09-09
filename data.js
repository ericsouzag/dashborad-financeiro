import {
  doc, setDoc, getDoc, getDocs, collection, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

// Campos fixos da planilha original do Eric — usados como padrão sugerido
// ao lançar um mês novo. O usuário pode editar valores, remover ou (em
// contas demo/visitante) adicionar campos próprios.
export const DEFAULT_FIXED_FIELDS = [
  { key: "c6", label: "C6 (fatura do cartão)", group: "cartao" },
  { key: "seguroAuto", label: "Seguro auto (já incluso no C6, só visualização)", group: "cartao", infoOnly: true },
  { key: "seguroVida", label: "Seguro vida (já incluso no C6, só visualização)", group: "cartao", infoOnly: true },
  { key: "stev", label: "Recebido do Stev (abate do C6)", group: "cartao", isCredit: true },
  { key: "itau", label: "Itaú (fatura do cartão)", group: "cartao" },
  { key: "gab", label: "Recebido do Gabriel (abate a diferença do Itaú)", group: "cartao", isCredit: true },
  { key: "marisa", label: "Marisa", group: "fixo" },
  { key: "mgnetSalinha", label: "MGNET (salinha)", group: "fixo" },
  { key: "vivo", label: "Vivo", group: "fixo" },
  { key: "cea", label: "C&A", group: "fixo" },
  { key: "riachuelo", label: "Riachuelo", group: "fixo" },
  { key: "seguro", label: "Seguro", group: "fixo" },
  { key: "cemig", label: "Cemig", group: "fixo" },
  { key: "consorcio", label: "Consórcio", group: "fixo" },
  { key: "mei", label: "MEI", group: "fixo" },
  { key: "mgnetCasa", label: "MGNET (casa)", group: "fixo" },
  { key: "copassa", label: "Copasa", group: "fixo" },
  { key: "claroRecarga", label: "Claro recarga", group: "fixo" },
  { key: "investimentos", label: "Investimentos", group: "investimento" },
];

// Meses excluídos das médias históricas por estarem zerados na planilha original.
export const EXCLUDED_MONTHS = ["2025-09", "2025-12"];

export function monthDocRef(uid, monthId) {
  return doc(db, "users", uid, "months", monthId);
}

export async function saveMonth(uid, monthId, fields) {
  const { total, totalComInvestimentos, totalLiquido } = computeMonthTotals(fields);
  await setDoc(monthDocRef(uid, monthId), {
    fields,
    total,
    totalComInvestimentos,
    totalLiquido,
    updatedAt: new Date().toISOString(),
  });
}

export async function getMonth(uid, monthId) {
  const snap = await getDoc(monthDocRef(uid, monthId));
  return snap.exists() ? snap.data() : null;
}

export async function listMonths(uid) {
  const q = query(collection(db, "users", uid, "months"), orderBy("__name__"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Replica a lógica da planilha:
 * - total = soma de todos os campos "gasto" (grupo cartao sem infoOnly,
 *   fixo) MENOS os créditos recebidos (stev, e a diferença itau-gab quando
 *   positiva a favor do usuário).
 * - totalComInvestimentos = total + investimentos.
 */
export function computeMonthTotals(fields) {
  let total = 0;
  let investimentos = 0;

  for (const [key, value] of Object.entries(fields)) {
    const def = DEFAULT_FIXED_FIELDS.find(f => f.key === key);
    const num = Number(value) || 0;
    if (def?.infoOnly) continue;
    if (def?.group === "investimento") { investimentos += num; continue; }
    if (def?.isCredit) continue; // tratado abaixo
    total += num;
  }

  const stev = Number(fields.stev) || 0;
  const gab = Number(fields.gab) || 0;
  const itau = Number(fields.itau) || 0;
  const diferencaItauGab = gab - itau; // se positivo, abate do total

  total -= stev;
  if (diferencaItauGab > 0) total -= diferencaItauGab;

  return {
    total: round2(total),
    totalComInvestimentos: round2(total + investimentos),
    totalLiquido: round2(total),
  };
}

export async function saveBoleto(uid, monthId, boletoData) {
  await setDoc(doc(db, "users", uid, "boletos", monthId), {
    ...boletoData,
    updatedAt: new Date().toISOString(),
  });
}

export async function getBoleto(uid, monthId) {
  const snap = await getDoc(doc(db, "users", uid, "boletos", monthId));
  return snap.exists() ? snap.data() : null;
}

export async function listBoletos(uid) {
  const q = query(collection(db, "users", uid, "boletos"), orderBy("__name__"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function round2(n) { return Math.round(n * 100) / 100; }
