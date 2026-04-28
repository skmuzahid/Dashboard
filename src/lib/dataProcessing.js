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

/* Convert raw month values to "Month - YYYY" format */
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function normalizeMonth(raw) {
  if (!raw || !String(raw).trim()) return "";
  const s = String(raw).trim();
  /* Already in "Month - YYYY" format? */
  if (/^[A-Za-z]+ - \d{4}$/.test(s)) return s;
  /* Try parsing as a date */
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${MONTH_NAMES[d.getMonth()]} - ${d.getFullYear()}`;
  }
  return s;
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

/* ─── Category Group definitions ─── */
const CATEGORY_GROUPS = {
  P2P: ["P2P", "MNP", "New Sim"],
  HomeWireless: ["HW Plus", "HW Entertainment", "HW Gaming"],
  InzoneFiber: ["HW to Fiber", "Fiber New"],
};

const GROUP_LABELS = {
  P2P: "P2P",
  HomeWireless: "Home Wireless",
  InzoneFiber: "Inzone Fiber",
};

/* ─── main processor ─── */
export function processData(rawData, selectedMonth) {
  /* keep only rows with a month AND "Activated" status */
  const data = rawData.filter(
    (row) =>
      row.Month &&
      row.Month.trim() !== "" &&
      row["Activation Status"] === "Activated"
  );

  /* unique months (in order of appearance, normalized) */
  const monthSet = new Set();
  rawData.forEach((r) => {
    const m = normalizeMonth(r.Month);
    if (m) monthSet.add(m);
  });
  const months = [...monthSet];

  /* filter by selected month (string, "All", or array of months) */
  const filtered =
    selectedMonth === "All"
      ? data
      : Array.isArray(selectedMonth)
        ? data.filter((row) => selectedMonth.includes(normalizeMonth(row.Month)))
        : data.filter((row) => normalizeMonth(row.Month) === selectedMonth);

  /* build deal objects */
  const deals = filtered.map((row) => ({
    month: normalizeMonth(row.Month),
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
  const salesCount = deals.length;
  const lossSales = deals.filter((d) => d.profit < 0);
  const lossRevenue = lossSales.reduce((s, d) => s + d.revenue, 0);

  /* ─── Agent aggregation ─── */
  const agentMap = {};
  deals.forEach((d) => {
    if (!agentMap[d.agent])
      agentMap[d.agent] = { sales: 0, profit: 0, revenue: 0 };
    agentMap[d.agent].sales++;
    agentMap[d.agent].profit += d.profit;
    agentMap[d.agent].revenue += d.revenue;
  });

  const agentLeaderboard = Object.entries(agentMap)
    .map(([name, d]) => ({
      name,
      sales: d.sales,
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

  /* ─── Agent × Category matrix (REVENUE instead of profit) ─── */
  const categories = [...new Set(deals.map((d) => d.category))].sort();
  const matrixData = {};
  const matrixProfitData = {};
  deals.forEach((d) => {
    if (!matrixData[d.agent]) matrixData[d.agent] = {};
    if (!matrixData[d.agent][d.category]) matrixData[d.agent][d.category] = 0;
    matrixData[d.agent][d.category] += d.revenue;

    if (!matrixProfitData[d.agent]) matrixProfitData[d.agent] = {};
    if (!matrixProfitData[d.agent][d.category]) matrixProfitData[d.agent][d.category] = 0;
    matrixProfitData[d.agent][d.category] += d.profit;
  });
  Object.keys(matrixData).forEach((agent) => {
    Object.keys(matrixData[agent]).forEach((cat) => {
      matrixData[agent][cat] = Math.round(matrixData[agent][cat]);
    });
  });
  Object.keys(matrixProfitData).forEach((agent) => {
    Object.keys(matrixProfitData[agent]).forEach((cat) => {
      matrixProfitData[agent][cat] = Math.round(matrixProfitData[agent][cat]);
    });
  });

  /* ─── Agent sales counts per category ─── */
  const matrixSalesData = {};
  deals.forEach((d) => {
    if (!matrixSalesData[d.agent]) matrixSalesData[d.agent] = {};
    if (!matrixSalesData[d.agent][d.category]) matrixSalesData[d.agent][d.category] = 0;
    matrixSalesData[d.agent][d.category]++;
  });

  /* ─── Category Group aggregation from sales ─── */
  const groupAchieved = {};
  Object.entries(CATEGORY_GROUPS).forEach(([groupKey, cats]) => {
    let groupSales = 0;
    let groupRevenue = 0;
    let groupProfit = 0;
    const subCategories = {};
    cats.forEach((cat) => {
      const catData = categoryMap[cat];
      if (catData) {
        groupSales += catData.count;
        groupRevenue += catData.revenue;
        groupProfit += catData.profit;
        subCategories[cat] = {
          sales: catData.count,
          revenue: Math.round(catData.revenue),
          profit: Math.round(catData.profit),
        };
      }
    });
    groupAchieved[groupKey] = {
      label: GROUP_LABELS[groupKey],
      sales: groupSales,
      revenue: Math.round(groupRevenue),
      profit: Math.round(groupProfit),
      subCategories,
    };
  });

  /* ─── Per-agent group aggregation (for matrix hover) ─── */
  const agentGroupData = {};
  agentLeaderboard.forEach((a) => {
    agentGroupData[a.name] = {};
    Object.entries(CATEGORY_GROUPS).forEach(([groupKey, cats]) => {
      let gSales = 0, gRevenue = 0, gProfit = 0;
      cats.forEach((cat) => {
        gSales += matrixSalesData[a.name]?.[cat] || 0;
        gRevenue += matrixData[a.name]?.[cat] || 0;
        gProfit += matrixProfitData[a.name]?.[cat] || 0;
      });
      agentGroupData[a.name][groupKey] = {
        label: GROUP_LABELS[groupKey],
        sales: gSales,
        revenue: gRevenue,
        profit: gProfit,
      };
    });
  });

  /* Sort agents by total revenue for matrix */
  const agentsByRevenue = [...agentLeaderboard].sort((a, b) => b.revenue - a.revenue);

  const uniqueAgents = new Set(deals.map((d) => d.agent)).size;

  return {
    kpis: {
      revenue: Math.round(totalRevenue),
      profit: Math.round(totalProfit),
      margin: margin.toFixed(1),
      sales: salesCount,
      lossRevenue: Math.round(lossRevenue),
      lossPercent:
        totalRevenue > 0
          ? ((lossRevenue / totalRevenue) * 100).toFixed(1)
          : "0",
      topAgent: topAgent
        ? { name: topAgent.name, profit: topAgent.profit, sales: topAgent.sales }
        : null,
      uniqueAgents,
      categoryCount: categories.length,
    },
    categoryPerformance,
    revenueMix,
    agentLeaderboard,
    agentCategoryMatrix: {
      agents: agentsByRevenue.map((a) => a.name),
      categories,
      data: matrixData,
      profitData: matrixProfitData,
      salesData: matrixSalesData,
      agentGroupData,
    },
    groupAchieved,
    salesLedger: deals.sort((a, b) => b.profit - a.profit),
    months,
    categories,
  };
}
