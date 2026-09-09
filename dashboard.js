import { EXCLUDED_MONTHS } from "./data.js";

const COLORS = { blue: "#3d8bff", yellow: "#f5c518", positive: "#4fd1c5", negative: "#ff6b5b", grid: "#232a3a", text: "#8792a8" };

export function monthLabel(id) {
  const [y, m] = id.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[parseInt(m,10)-1]}/${y.slice(2)}`;
}

function usableMonths(months) {
  return months.filter(m => !EXCLUDED_MONTHS.includes(m.id));
}

export function monthlyTotalsSeries(months) {
  const usable = [...usableMonths(months)].sort((a,b) => a.id.localeCompare(b.id));
  return {
    labels: usable.map(m => monthLabel(m.id)),
    totals: usable.map(m => m.total || 0),
    totalsComInvest: usable.map(m => m.totalComInvestimentos || 0),
  };
}

export function categoryAverage(months, fieldKey) {
  const usable = usableMonths(months).filter(m => m.fields && m.fields[fieldKey] !== undefined);
  if (!usable.length) return 0;
  const sum = usable.reduce((s, m) => s + (Number(m.fields[fieldKey]) || 0), 0);
  return sum / usable.length;
}

/** Compara categorias do boleto do mês atual x média histórica x mês anterior */
export function compareCardCategories(currentBoleto, allBoletos) {
  const others = allBoletos.filter(b => b.id !== currentBoleto.id && !EXCLUDED_MONTHS.includes(b.id));
  const sortedIds = [...allBoletos.map(b => b.id)].sort();
  const idx = sortedIds.indexOf(currentBoleto.id);
  const prevId = idx > 0 ? sortedIds[idx - 1] : null;
  const prevBoleto = allBoletos.find(b => b.id === prevId);

  const catTotals = {};
  for (const t of currentBoleto.transactions || []) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  }

  const catAverages = {};
  const catCounts = {};
  for (const b of others) {
    const seen = new Set();
    for (const t of b.transactions || []) {
      catAverages[t.category] = (catAverages[t.category] || 0) + t.amount;
      if (!seen.has(t.category)) { catCounts[t.category] = (catCounts[t.category] || 0) + 1; seen.add(t.category); }
    }
  }
  for (const cat of Object.keys(catAverages)) {
    catAverages[cat] = catAverages[cat] / (catCounts[cat] || 1);
  }

  const catPrev = {};
  for (const t of (prevBoleto?.transactions || [])) {
    catPrev[t.category] = (catPrev[t.category] || 0) + t.amount;
  }

  const categories = new Set([...Object.keys(catTotals), ...Object.keys(catAverages), ...Object.keys(catPrev)]);
  return [...categories].map(cat => ({
    category: cat,
    current: round2(catTotals[cat] || 0),
    average: round2(catAverages[cat] || 0),
    previous: round2(catPrev[cat] || 0),
  })).sort((a,b) => b.current - a.current);
}

function round2(n) { return Math.round(n*100)/100; }

export function fmtBRL(n) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------- render helpers (Chart.js via window.Chart) ----------

const chartInstances = {};

export function renderLineChart(canvasId, labels, datasets) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  chartInstances[canvasId] = new window.Chart(ctx, {
    type: "line",
    data: { labels, datasets: datasets.map((d, i) => ({
      label: d.label, data: d.data, borderColor: d.color || COLORS.blue,
      backgroundColor: "transparent", tension: 0.3, pointRadius: 3,
      borderWidth: 2,
    })) },
    options: baseOptions(),
  });
}

export function renderBarChart(canvasId, labels, datasets) {
  destroyIfExists(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  chartInstances[canvasId] = new window.Chart(ctx, {
    type: "bar",
    data: { labels, datasets: datasets.map(d => ({
      label: d.label, data: d.data, backgroundColor: d.color || COLORS.blue, borderRadius: 3,
    })) },
    options: baseOptions(),
  });
}

function destroyIfExists(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: COLORS.text, font: { family: "Inter", size: 12 } } },
    },
    scales: {
      x: { ticks: { color: COLORS.text }, grid: { color: COLORS.grid } },
      y: { ticks: { color: COLORS.text }, grid: { color: COLORS.grid } },
    },
  };
}
