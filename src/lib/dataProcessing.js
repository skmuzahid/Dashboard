/* ─── helpers ─── */
function normalizeAgent(name) {
  if (!name || !name.trim()) return "Unknown";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function parseNum(val) {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

const CATEGORY_DISPLAY = { NEW: "New Sim" };
function displayCategory(cat) {
  return CATEGORY_DISPLAY[cat] || cat;
}

const CATEGORY_COLORS = {
  "HW Plus": "#8b5cf6",
  "HW to Fiber": "#10b981",
  P2P: "#f59e0b",
  "New Sim": "#3b82f6",
  NEW: "#3b82f6",
  "Fiber New": "#f97316",
  "HW Gaming": "#06b6d4",
  MNP: "#14b8a6",
  "HW Entertainment": "#ef4444",
  HW: "#ec4899",
};

const CHART_PURPLES = [
  "#8b5cf6", "#7c3aed", "#a78bfa", "#6d28d9",
  "#c4b5fd", "#9333ea", "#7e22ce", "#6366f1",
  "#818cf8", "#5b21b6",
];

/* ─── main processor ─── */
export function processData(rawData, selectedMonth) {
  /* keep only rows with a month AND "Activated" status */
  const data = rawData.filter(
    (row) =>
      row.Month &&
      row.Month.trim() !== "" &&
      row["Activation Status"] === "Activated"
  );

  /* unique months (in order of appearance) */
  const monthSet = new Set();
  rawData.forEach((r) => {
    if (r.Month && r.Month.trim()) monthSet.add(r.Month.trim());
  });
  const months = [...monthSet];

  /* filter by selected month */
  const filtered =
    selectedMonth === "All"
      ? data
      : data.filter((row) => row.Month.trim() === selectedMonth);

  /* build deal objects */
  const deals = filtered.map((row) => ({
    month: row.Month,
    date: row["Activation Date"] || "",
    agent: normalizeAgent(row["Agent name"]),
    category: displayCategory(row.category || "Unknown"),
    account: row.Account || "",
    ratePlan: row["Rate Plan"] || "",
    mrc: parseNum(row.MRC),
    discount: row.Discount || "",
    mrcAfterDiscount: parseNum(row["MRC After Discount"]),
    status: row["Activation Status"],
    revenue: parseNum(row.Revenue),
    commissionStatus: row["Commission Status"] || "",
    commissionAmount: parseNum(row["Commission Amount"]),
    profit: parseNum(row.PROFIT),
  }));

  /* ─── KPIs ─── */
  const totalRevenue = deals.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = deals.reduce((s, d) => s + d.profit, 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const dealCount = deals.length;
  const lossDeals = deals.filter((d) => d.profit < 0).length;

  /* ─── Agent aggregation ─── */
  const agentMap = {};
  deals.forEach((d) => {
    if (!agentMap[d.agent])
      agentMap[d.agent] = { deals: 0, profit: 0, revenue: 0 };
    agentMap[d.agent].deals++;
    agentMap[d.agent].profit += d.profit;
    agentMap[d.agent].revenue += d.revenue;
  });

  const agentLeaderboard = Object.entries(agentMap)
    .map(([name, d]) => ({
      name,
      deals: d.deals,
      profit: Math.round(d.profit),
      revenue: Math.round(d.revenue),
      margin: d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  const topAgent = agentLeaderboard[0] || null;

  /* ─── Category aggregation ─── */
  const categoryMap = {};
  deals.forEach((d) => {
    if (!categoryMap[d.category])
      categoryMap[d.category] = { revenue: 0, profit: 0, count: 0 };
    categoryMap[d.category].revenue += d.revenue;
    categoryMap[d.category].profit += d.profit;
    categoryMap[d.category].count++;
  });

  const categoryPerformance = Object.entries(categoryMap)
    .map(([name, d], i) => ({
      name,
      revenue: Math.round(d.revenue),
      profit: Math.round(d.profit),
      margin:
        d.revenue > 0
          ? parseFloat(((d.profit / d.revenue) * 100).toFixed(1))
          : 0,
      count: d.count,
      color: CATEGORY_COLORS[name] || "#8b5cf6",
      chartColor: CHART_PURPLES[i % CHART_PURPLES.length],
    }))
    .sort((a, b) => b.revenue - a.revenue);

  /* ─── Revenue mix ─── */
  const revenueMix = categoryPerformance.map((c) => ({
    name: c.name,
    value: c.revenue,
    percentage:
      totalRevenue > 0
        ? parseFloat(((c.revenue / totalRevenue) * 100).toFixed(1))
        : 0,
    color: c.color,
  }));

  /* ─── Agent × Category matrix ─── */
  const categories = [...new Set(deals.map((d) => d.category))].sort();
  const matrixData = {};
  deals.forEach((d) => {
    if (!matrixData[d.agent]) matrixData[d.agent] = {};
    if (!matrixData[d.agent][d.category])
      matrixData[d.agent][d.category] = 0;
    matrixData[d.agent][d.category] += d.profit;
  });
  Object.keys(matrixData).forEach((agent) => {
    Object.keys(matrixData[agent]).forEach((cat) => {
      matrixData[agent][cat] = Math.round(matrixData[agent][cat]);
    });
  });

  const uniqueAgents = new Set(deals.map((d) => d.agent)).size;

  return {
    kpis: {
      revenue: Math.round(totalRevenue),
      profit: Math.round(totalProfit),
      margin: margin.toFixed(1),
      deals: dealCount,
      lossDeals,
      lossPercent:
        dealCount > 0
          ? ((lossDeals / dealCount) * 100).toFixed(1)
          : "0",
      topAgent: topAgent
        ? { name: topAgent.name, profit: topAgent.profit, deals: topAgent.deals }
        : null,
      uniqueAgents,
      categoryCount: categories.length,
    },
    categoryPerformance,
    revenueMix,
    agentLeaderboard,
    agentCategoryMatrix: {
      agents: agentLeaderboard.map((a) => a.name),
      categories,
      data: matrixData,
    },
    dealLedger: deals.sort((a, b) => b.profit - a.profit),
    months,
    categories,
  };
}
