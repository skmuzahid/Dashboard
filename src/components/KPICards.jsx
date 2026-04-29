"use client";

const fmt = (n) => Number(n).toLocaleString();

const cards = [
  {
    key: "revenue",
    label: "REVENUE",
    icon: "💰",
    value: (k) => `AED ${fmt(k.revenue)}`,
    sub: (k) => `${(k.revenue / 1000).toFixed(1)}K across ${k.sales} sales`,
  },
  {
    key: "profit",
    label: " NET PROFIT",
    icon: "📈",
    value: (k) => `AED ${fmt(k.adjustedProfit)}`,
    sub: (k) => `${k.adjustedMargin}% of total revenue`,
    valueClass: (k) => k.adjustedProfit >= 0 ? "text-emerald-400" : "text-rose-400",
  },
  {
    key: "margin",
    label: "MARGIN",
    icon: "％",
    value: (k) => `${k.adjustedMargin}%`,
    sub: (k) => `after operational costs - AED ${fmt(k.operationalCost)} `,
    valueClass: (k) => Number(k.adjustedMargin) >= 0 ? "text-emerald-400" : "text-rose-400",
  },
  {
    key: "sales",
    label: "SALES",
    icon: "📊",
    value: (k) => k.sales,
    sub: (k) => `${k.uniqueAgents} agents · ${k.categoryCount} categories`,
  },
  {
    key: "loss",
    label: "LOSS REVENUE",
    icon: "📉",
    value: (k) => `AED ${fmt(k.lossRevenue)}`,
    sub: (k) => `${k.lossPercent}% of total revenue`,
    valueClass: "text-rose-400",
  },
  {
    key: "top",
    label: "TOP AGENT",
    icon: "🏆",
    value: (k) => k.topAgentFullTime?.name || "–",
    sub: (k) =>
      k.topAgentFullTime
        ? `AED ${fmt(k.topAgentFullTime.revenue)} revenue · ${k.topAgentFullTime.sales} sales`
        : "",
    valueClass: "text-emerald-400",
  },
];

export default function KPICards({ data }) {
  if (!data) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.key}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between min-h-[130px]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              {c.label}
            </span>
            <span className="text-lg">{c.icon}</span>
          </div>
          <p
            className={`text-2xl font-bold tracking-tight ${typeof c.valueClass === "function" ? c.valueClass(data) : c.valueClass || "text-white"}`}
          >
            {c.value(data)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{c.sub(data)}</p>
        </div>
      ))}
    </div>
  );
}
