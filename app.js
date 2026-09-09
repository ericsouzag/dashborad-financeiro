import { loginEmail, loginDemo, loginVisitor, logout, watchAuth, getAccountKind } from "./auth.js";
import {
  DEFAULT_FIXED_FIELDS, EXCLUDED_MONTHS, saveMonth, getMonth, listMonths,
  computeMonthTotals, saveBoleto, getBoleto, listBoletos,
} from "./data.js";
import { parseC6Boleto } from "./pdf-parser.js";
import {
  monthlyTotalsSeries, categoryAverage, compareCardCategories,
  renderLineChart, renderBarChart, fmtBRL, monthLabel,
} from "./dashboard.js";
import { CATEGORIES } from "./categorize-rules.js";
import { C6_PDF_PASSWORD } from "./firebase-config.js";

let state = {
  uid: null,
  accountKind: null,
  months: [],
  boletos: [],
  customFields: [],
  parsedTransactions: null,
};

const $ = id => document.getElementById(id);

// ------------------------------------------------------------------ auth

$("btnLogin").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return showLoginError("Preencha e-mail e senha.");
  try {
    await loginEmail(email, password);
  } catch (e) {
    showLoginError(translateAuthError(e.code));
  }
});

$("password").addEventListener("keydown", e => { if (e.key === "Enter") $("btnLogin").click(); });

$("btnDemo").addEventListener("click", async () => {
  try { await loginDemo(); }
  catch (e) { showLoginError("A conta de demonstração ainda não foi criada no Firebase."); }
});

$("btnVisitor").addEventListener("click", async () => {
  try { await loginVisitor(); }
  catch (e) { showLoginError("Não foi possível abrir o painel de teste. Ative o login anônimo no Firebase."); }
});

$("btnLogout").addEventListener("click", () => logout());

function showLoginError(msg) {
  const el = $("loginError");
  el.textContent = msg;
  el.classList.add("show");
}

function translateAuthError(code) {
  const map = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Não existe conta com esse e-mail.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Espere um instante e tente de novo.",
    "auth/invalid-email": "E-mail inválido.",
  };
  return map[code] || "Não foi possível entrar. Tente novamente.";
}

watchAuth(async user => {
  if (!user) {
    $("loginScreen").classList.remove("hidden");
    $("appShell").classList.add("hidden");
    state = { uid: null, accountKind: null, months: [], boletos: [], customFields: [], parsedTransactions: null };
    return;
  }
  state.uid = user.uid;
  state.accountKind = (await getAccountKind(user.uid)) || (user.isAnonymous ? "visitor" : "owner");
  $("loginScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  applyAccountMode();
  await refreshAll();
});

function applyAccountMode() {
  const labels = { owner: "conta pessoal", demo: "demonstração", visitor: "painel de teste" };
  for (const id of ["accountBadgeDesktop", "accountBadgeMobile"]) {
    const el = $(id);
    el.querySelector("span:last-child").textContent = labels[state.accountKind] || "conta";
    el.classList.toggle("demo", state.accountKind === "demo");
  }
  // Visitante pode criar campos próprios; demo é somente leitura.
  $("customFieldsWrap").classList.toggle("hidden", state.accountKind !== "visitor");
  const readOnly = state.accountKind === "demo";
  $("btnSaveMonth").disabled = readOnly;
  $("btnSaveBoleto").disabled = readOnly;
  $("pdfHint").textContent = state.accountKind === "owner"
    ? "A senha do arquivo é aplicada automaticamente."
    : "Se o PDF tiver senha, informe abaixo.";
  $("pdfPasswordWrap").classList.toggle("hidden", state.accountKind === "owner");
}

// ------------------------------------------------------------------ navegação

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(i =>
    i.classList.toggle("active", i.dataset.view === view));
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ dados

async function refreshAll() {
  state.months = await listMonths(state.uid);
  state.boletos = await listBoletos(state.uid);
  buildMonthForm();
  renderDashboard();
  renderHistorico();
  populateCompMonths();
  renderComparativo();
}

// ------------------------------------------------------------------ formulário do mês

function buildMonthForm() {
  const groups = { cartao: $("fieldsCartao"), fixo: $("fieldsFixos"), investimento: $("fieldsInvest") };
  Object.values(groups).forEach(el => el.innerHTML = "");

  for (const f of DEFAULT_FIXED_FIELDS) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const tag = f.infoOnly ? "só visualização" : f.isCredit ? "recebido" : "";
    wrap.innerHTML = `
      <label for="fld-${f.key}">${f.label}${tag ? `<span class="tag">${tag}</span>` : ""}</label>
      <input type="number" step="0.01" id="fld-${f.key}" data-key="${f.key}" placeholder="0,00" />`;
    groups[f.group].appendChild(wrap);
  }

  document.querySelectorAll('[id^="fld-"]').forEach(input =>
    input.addEventListener("input", updateLivePreview));

  if (!$("monthPicker").value) $("monthPicker").value = currentMonthId();
  loadMonthIntoForm($("monthPicker").value);
}

$("monthPicker").addEventListener("change", e => loadMonthIntoForm(e.target.value));

async function loadMonthIntoForm(monthId) {
  const data = await getMonth(state.uid, monthId);
  document.querySelectorAll('[id^="fld-"]').forEach(input => {
    const key = input.dataset.key;
    input.value = data?.fields?.[key] ?? "";
  });
  updateLivePreview();
}

function collectFields() {
  const fields = {};
  document.querySelectorAll('[id^="fld-"]').forEach(input => {
    if (input.value !== "") fields[input.dataset.key] = Number(input.value);
  });
  document.querySelectorAll('[data-custom-key]').forEach(input => {
    if (input.value !== "") fields[input.dataset.customKey] = Number(input.value);
  });
  return fields;
}

function updateLivePreview() {
  const fields = collectFields();
  const { total, totalComInvestimentos } = computeMonthTotals(fields);
  const stev = Number(fields.stev) || 0;
  const itau = Number(fields.itau) || 0;
  const gab = Number(fields.gab) || 0;
  const dif = gab - itau;

  $("livePreview").innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
      <div><div class="kpi-label">Total</div><div class="kpi-value">${fmtBRL(total)}</div></div>
      <div><div class="kpi-label">Total + investimentos</div><div class="kpi-value">${fmtBRL(totalComInvestimentos)}</div></div>
      <div><div class="kpi-label">Abatido pelo Stev</div><div class="kpi-value" style="font-size:20px">${fmtBRL(stev)}</div></div>
      <div><div class="kpi-label">Sobra do Itaú/Gabriel</div><div class="kpi-value" style="font-size:20px">${fmtBRL(Math.max(dif,0))}</div></div>
    </div>`;
}

$("btnSaveMonth").addEventListener("click", async () => {
  const monthId = $("monthPicker").value;
  if (!monthId) return toast("Escolha o mês de referência.", "error");
  try {
    await saveMonth(state.uid, monthId, collectFields());
    await refreshAll();
    toast(`Mês ${monthLabel(monthId)} salvo.`, "success");
  } catch (e) {
    toast("Não foi possível salvar. Verifique a conexão.", "error");
  }
});

$("btnClearMonth").addEventListener("click", () => {
  document.querySelectorAll('[id^="fld-"]').forEach(i => i.value = "");
  updateLivePreview();
});

$("btnAddField").addEventListener("click", () => {
  const name = prompt("Nome do campo:");
  if (!name) return;
  const key = "custom_" + name.toLowerCase().replace(/\W+/g, "_");
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.innerHTML = `<label>${name}</label>
    <input type="number" step="0.01" data-custom-key="${key}" placeholder="0,00" />`;
  $("fieldsCustom").appendChild(wrap);
  wrap.querySelector("input").addEventListener("input", updateLivePreview);
});

// ------------------------------------------------------------------ upload do boleto

const dropzone = $("dropzone");
dropzone.addEventListener("click", () => $("pdfInput").click());
dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  if (e.dataTransfer.files[0]) handlePdf(e.dataTransfer.files[0]);
});
$("pdfInput").addEventListener("change", e => {
  if (e.target.files[0]) handlePdf(e.target.files[0]);
});

async function handlePdf(file) {
  if (!$("boletoMonth").value) return toast("Escolha o mês da fatura primeiro.", "error");
  $("pdfProgress").style.width = "35%";
  const password = state.accountKind === "owner" ? C6_PDF_PASSWORD : $("pdfPassword").value;

  try {
    const { transactions, rawTotal } = await parseC6Boleto(file, password);
    $("pdfProgress").style.width = "100%";
    if (!transactions.length) {
      toast("Nenhuma transação foi reconhecida nesse PDF.", "error");
      return;
    }
    state.parsedTransactions = transactions;
    renderTxTable(transactions, rawTotal);
    $("boletoResult").classList.remove("hidden");
    toast(`${transactions.length} transações lidas.`, "success");
  } catch (e) {
    $("pdfProgress").style.width = "0%";
    if (e.name === "PasswordException") {
      toast("A senha não abriu esse PDF. Confira o arquivo.", "error");
    } else {
      toast("Não foi possível ler o PDF.", "error");
    }
  }
}

function renderTxTable(transactions, rawTotal) {
  const rows = transactions.map((t, i) => `
    <tr>
      <td class="muted">${t.date}</td>
      <td>${escapeHtml(t.description)}${t.installment ? ` <span class="muted">(${t.installment})</span>` : ""}</td>
      <td>
        <select data-tx-index="${i}">
          ${CATEGORIES.map(c => `<option ${c === t.category ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </td>
      <td style="text-align:right">${fmtBRL(t.amount)}</td>
    </tr>`).join("");

  $("txTable").innerHTML = `
    <thead><tr><th>Data</th><th>Estabelecimento</th><th>Categoria</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="3"><strong>Total lido</strong></td>
    <td style="text-align:right"><strong>${fmtBRL(rawTotal)}</strong></td></tr></tfoot>`;

  $("txTable").querySelectorAll("[data-tx-index]").forEach(sel => {
    sel.addEventListener("change", e => {
      state.parsedTransactions[Number(e.target.dataset.txIndex)].category = e.target.value;
    });
  });
}

$("btnSaveBoleto").addEventListener("click", async () => {
  const monthId = $("boletoMonth").value;
  if (!monthId || !state.parsedTransactions) return;
  const total = state.parsedTransactions.reduce((s, t) => s + t.amount, 0);
  try {
    await saveBoleto(state.uid, monthId, { transactions: state.parsedTransactions, total });
    await refreshAll();
    toast(`Fatura de ${monthLabel(monthId)} salva.`, "success");
    switchView("comparativo");
  } catch (e) {
    toast("Não foi possível salvar a fatura.", "error");
  }
});

// ------------------------------------------------------------------ dashboard

function renderDashboard() {
  const usable = state.months.filter(m => !EXCLUDED_MONTHS.includes(m.id));
  if (!usable.length) {
    $("dashPeriod").textContent = "sem dados ainda";
    $("kpiGrid").innerHTML = `<div class="card card-notch empty-state">
      Nenhum mês lançado. Comece em "Lançar o mês".</div>`;
    $("tableAverages").innerHTML = "";
    return;
  }

  const sorted = [...usable].sort((a, b) => a.id.localeCompare(b.id));
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const avgTotal = sorted.reduce((s, m) => s + (m.total || 0), 0) / sorted.length;

  $("dashPeriod").textContent =
    `${monthLabel(sorted[0].id)} — ${monthLabel(last.id)} · ${sorted.length} meses`;

  const delta = prev ? ((last.total - prev.total) / (prev.total || 1)) * 100 : 0;
  const deltaClass = !prev ? "flat" : delta > 0 ? "up" : "down";
  const deltaText = !prev ? "primeiro mês" :
    `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% em relação a ${monthLabel(prev.id)}`;

  $("kpiGrid").innerHTML = `
    ${kpi("Total do último mês", fmtBRL(last.total), deltaText, deltaClass)}
    ${kpi("Com investimentos", fmtBRL(last.totalComInvestimentos), monthLabel(last.id), "flat")}
    ${kpi("Média mensal", fmtBRL(avgTotal), `${sorted.length} meses considerados`, "flat")}
    ${kpi("Recebido no mês", fmtBRL((Number(last.fields?.stev) || 0) + Math.max((Number(last.fields?.gab) || 0) - (Number(last.fields?.itau) || 0), 0)), "Stev + sobra do Gabriel", "flat")}`;

  const series = monthlyTotalsSeries(state.months);
  renderLineChart("chartTotals", series.labels, [
    { label: "Total", data: series.totals, color: "#3d8bff" },
    { label: "Com investimentos", data: series.totalsComInvest, color: "#f5c518" },
  ]);

  const fixos = DEFAULT_FIXED_FIELDS.filter(f => f.group === "fixo");
  renderBarChart("chartFixos", fixos.map(f => f.label.split(" (")[0]), [
    { label: "Último mês", data: fixos.map(f => Number(last.fields?.[f.key]) || 0), color: "#3d8bff" },
    { label: "Média", data: fixos.map(f => categoryAverage(state.months, f.key)), color: "#8a731c" },
  ]);

  const rows = DEFAULT_FIXED_FIELDS.map(f => {
    const avg = categoryAverage(state.months, f.key);
    const cur = Number(last.fields?.[f.key]) || 0;
    const diff = cur - avg;
    return `<tr>
      <td>${f.label}</td>
      <td style="text-align:right">${fmtBRL(cur)}</td>
      <td style="text-align:right" class="muted">${fmtBRL(avg)}</td>
      <td style="text-align:right;color:${diff > 0 ? "var(--negative)" : "var(--positive)"}">
        ${diff >= 0 ? "+" : ""}${fmtBRL(diff)}</td>
    </tr>`;
  }).join("");

  $("tableAverages").innerHTML = `
    <thead><tr><th>Item</th><th style="text-align:right">${monthLabel(last.id)}</th>
    <th style="text-align:right">Média</th><th style="text-align:right">Diferença</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

function kpi(label, value, delta, deltaClass) {
  return `<div class="card card-notch">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-delta ${deltaClass}">${delta}</div>
  </div>`;
}

// ------------------------------------------------------------------ comparativo do cartão

function populateCompMonths() {
  const sel = $("compMonth");
  const ids = state.boletos.map(b => b.id).sort().reverse();
  sel.innerHTML = ids.map(id => `<option value="${id}">${monthLabel(id)}</option>`).join("");
}

$("compMonth").addEventListener("change", renderComparativo);

function renderComparativo() {
  const monthId = $("compMonth").value;
  const current = state.boletos.find(b => b.id === monthId);
  if (!current) {
    $("tableComparativo").innerHTML = `<tbody><tr><td class="empty-state">
      Envie uma fatura em PDF para ver o comparativo por categoria.</td></tr></tbody>`;
    return;
  }

  const comp = compareCardCategories(current, state.boletos);

  renderBarChart("chartCategorias", comp.map(c => c.category), [
    { label: monthLabel(monthId), data: comp.map(c => c.current), color: "#3d8bff" },
    { label: "Média", data: comp.map(c => c.average), color: "#8a731c" },
    { label: "Mês anterior", data: comp.map(c => c.previous), color: "#2a4a7a" },
  ]);

  $("tableComparativo").innerHTML = `
    <thead><tr><th>Categoria</th><th style="text-align:right">Este mês</th>
    <th style="text-align:right">Média</th><th style="text-align:right">Mês anterior</th>
    <th style="text-align:right">vs. média</th></tr></thead>
    <tbody>${comp.map(c => {
      const diff = c.current - c.average;
      return `<tr>
        <td><span class="cat-pill">${c.category}</span></td>
        <td style="text-align:right">${fmtBRL(c.current)}</td>
        <td style="text-align:right" class="muted">${fmtBRL(c.average)}</td>
        <td style="text-align:right" class="muted">${fmtBRL(c.previous)}</td>
        <td style="text-align:right;color:${diff > 0 ? "var(--negative)" : "var(--positive)"}">
          ${diff >= 0 ? "+" : ""}${fmtBRL(diff)}</td>
      </tr>`;
    }).join("")}</tbody>`;
}

// ------------------------------------------------------------------ histórico

function renderHistorico() {
  if (!state.months.length) {
    $("tableHistorico").innerHTML = `<tbody><tr><td class="empty-state">
      Nenhum mês salvo ainda.</td></tr></tbody>`;
    return;
  }
  const sorted = [...state.months].sort((a, b) => b.id.localeCompare(a.id));
  $("tableHistorico").innerHTML = `
    <thead><tr><th>Mês</th><th style="text-align:right">Total</th>
    <th style="text-align:right">Com investimentos</th><th>Fatura anexada</th></tr></thead>
    <tbody>${sorted.map(m => `
      <tr>
        <td>${monthLabel(m.id)}${EXCLUDED_MONTHS.includes(m.id) ? ' <span class="muted">(fora da média)</span>' : ""}</td>
        <td style="text-align:right">${fmtBRL(m.total)}</td>
        <td style="text-align:right">${fmtBRL(m.totalComInvestimentos)}</td>
        <td>${state.boletos.some(b => b.id === m.id) ? "sim" : '<span class="muted">não</span>'}</td>
      </tr>`).join("")}</tbody>`;
}

// ------------------------------------------------------------------ utilitários

function currentMonthId() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let toastTimer;
function toast(msg, kind = "success") {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4000);
}

// Service worker (permite instalar como ícone na tela inicial)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
