"use client";
import { useState, useMemo } from "react";

const fmt = (n) => Number(n).toLocaleString();

const GROUP_COLORS = {
  P2P: "#f59e0b",
  HomeWireless: "#8b5cf6",
  InzoneFiber: "#10b981",
};

const GROUP_ORDER = ["P2P", "HomeWireless", "InzoneFiber"];

export default function TargetAchievement({ groupAchieved, targets, selectedMonth }) {
  const [hovered, setHovered] = useState(null); // { groupKey, type: "deals"|"revenue" }

  /* Resolve target for the selected month.
     When "All" is selected, sum targets across all months in the env. */
  const monthTarget = useMemo(() => {
    if (!targets) return {};
    if (selectedMonth !== "All") {
      return targets[selectedMonth] || {};
    }
    /* "All" → sum all month targets */
    const summed = {};
    Object.values(targets).forEach((mt) => {
      Object.entries(mt).forEach(([gk, gv]) => {
        if (!summed[gk]) summed[gk] = { deals: 0, revenue: 0 };
        summed[gk].deals += gv.deals || 0;
        summed[gk].revenue += gv.revenue || 0;
      });
    });
    return summed;
  }, [targets, selectedMonth]);

  if (!groupAchieved) return null;

  const pct = (achieved, target) => {
    if (!target || target === 0) return 0;
    return Math.min(Math.round((achieved / target) * 100), 999);
  };

  const barWidth = (achieved, target) => {
    if (!target || target === 0) return 0;
    return Math.min((achieved / target) * 100, 100);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-lg">Target vs Achieved</h3>
        <span className="text-lg">🎯</span>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Category group targets. Hover values for sub-category breakdown.
      </p>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 mb-2 px-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Group</span>
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Deals</span>
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Revenue</span>
      </div>

      <div className="space-y-3 flex-1">
        {GROUP_ORDER.map((gk) => {
          const achieved = groupAchieved[gk];
          if (!achieved) return null;
          const target = monthTarget[gk] || { deals: 0, revenue: 0 };
          const color = GROUP_COLORS[gk];

          return (
            <div key={gk} className="bg-gray-800/50 rounded-lg p-3">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-start">
                {/* Group name */}
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-white text-sm font-medium leading-tight">{achieved.label}</span>
                </div>

                {/* Deals achieved */}
                <div
                  className="relative text-center cursor-pointer"
                  onMouseEnter={() => setHovered({ groupKey: gk, type: "deals" })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="text-white text-sm font-semibold tabular-nums">
                    {achieved.deals}
                    <span className="text-gray-500 font-normal"> / {target.deals || "—"}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${barWidth(achieved.deals, target.deals)}%`,
                        backgroundColor: pct(achieved.deals, target.deals) >= 100 ? "#10b981" : color,
                      }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${pct(achieved.deals, target.deals) >= 100 ? "text-emerald-400" : "text-gray-400"}`}>
                    {target.deals ? `${pct(achieved.deals, target.deals)}%` : "—"}
                  </span>

                  {/* Tooltip */}
                  {hovered?.groupKey === gk && hovered?.type === "deals" && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[160px] text-left">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Deals Breakdown</p>
                      {Object.entries(achieved.subCategories || {}).map(([cat, d]) => (
                        <div key={cat} className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-300">{cat}</span>
                          <span className="text-white font-medium tabular-nums">{d.deals}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-700 mt-1.5 pt-1 flex justify-between text-xs">
                        <span className="text-gray-400">Total</span>
                        <span className="text-white font-semibold">{achieved.deals}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Revenue achieved */}
                <div
                  className="relative text-center cursor-pointer"
                  onMouseEnter={() => setHovered({ groupKey: gk, type: "revenue" })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="text-white text-sm font-semibold tabular-nums">
                    {fmt(achieved.revenue)}
                    <span className="text-gray-500 font-normal"> / {target.revenue ? fmt(target.revenue) : "—"}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${barWidth(achieved.revenue, target.revenue)}%`,
                        backgroundColor: pct(achieved.revenue, target.revenue) >= 100 ? "#10b981" : color,
                      }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${pct(achieved.revenue, target.revenue) >= 100 ? "text-emerald-400" : "text-gray-400"}`}>
                    {target.revenue ? `${pct(achieved.revenue, target.revenue)}%` : "—"}
                  </span>

                  {/* Tooltip */}
                  {hovered?.groupKey === gk && hovered?.type === "revenue" && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[180px] text-left">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Revenue Breakdown</p>
                      {Object.entries(achieved.subCategories || {}).map(([cat, d]) => (
                        <div key={cat} className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-300">{cat}</span>
                          <span className="text-white font-medium tabular-nums">AED {fmt(d.revenue)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-700 mt-1.5 pt-1 flex justify-between text-xs">
                        <span className="text-gray-400">Total</span>
                        <span className="text-white font-semibold">AED {fmt(achieved.revenue)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
