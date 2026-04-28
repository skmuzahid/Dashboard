"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const fmt = (n) => Number(n).toLocaleString();

const GROUP_LABELS = { P2P: "P2P", HomeWireless: "Home Wireless", InzoneFiber: "Inzone Fiber" };

function getCellBg(value, maxVal) {
  if (value === undefined || value === null) return "transparent";
  if (value < 0) return "rgba(239, 68, 68, 0.15)";
  const intensity = Math.min(Math.abs(value) / (maxVal || 1), 1);
  return `rgba(139, 92, 246, ${0.08 + intensity * 0.35})`;
}

/* Portal-based tooltip that renders at the body level — never clipped */
function PortalTooltip({ anchor, children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !anchor) return null;

  const rect = anchor.getBoundingClientRect();
  /* Position to the left of the element, vertically centered */
  const style = {
    position: "fixed",
    top: rect.top + rect.height / 2,
    left: rect.left - 8,
    transform: "translate(-100%, -50%)",
    zIndex: 9999,
  };

  return createPortal(
    <div style={style}>
      {children}
    </div>,
    document.body
  );
}

export default function AgentCategoryMatrix({ data, targets, selectedMonth, groupAchieved }) {
  const [hoveredAgent, setHoveredAgent] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleHover = useCallback((agent, e) => {
    setHoveredAgent(agent);
    setAnchorEl(e.currentTarget);
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredAgent(null);
    setAnchorEl(null);
  }, []);

  if (!data || !data.agents || data.agents.length === 0) return null;

  const { agents, categories, data: matrix, profitData, salesData, agentGroupData } = data;

  /* find max value for heat-map intensity */
  let maxVal = 0;
  agents.forEach((agent) => {
    categories.forEach((cat) => {
      const v = matrix[agent]?.[cat];
      if (v !== undefined && Math.abs(v) > maxVal) maxVal = Math.abs(v);
    });
  });

  /* Compute total revenue per agent */
  const agentTotals = {};
  agents.forEach((agent) => {
    let total = 0;
    categories.forEach((cat) => { total += matrix[agent]?.[cat] || 0; });
    agentTotals[agent] = total;
  });

  /* Sort agents by total revenue for display */
  const sortedAgents = [...agents].sort((a, b) => (agentTotals[b] || 0) - (agentTotals[a] || 0));

  const rankIcon = (idx) => {
    if (idx === 0) return <span title="1st">🏆</span>;
    if (idx === 1) return <span title="2nd">🥈</span>;
    if (idx === 2) return <span title="3rd">🥉</span>;
    return null;
  };

  /* Max total for heat-map on total column */
  const maxTotal = Math.max(...Object.values(agentTotals).map(Math.abs), 1);

  /* Resolve month target for contribution % calculation */
  const monthTarget = useMemo(() => {
    if (!targets) return {};
    if (selectedMonth !== "All" && !Array.isArray(selectedMonth)) return targets[selectedMonth] || {};
    const monthKeys = Array.isArray(selectedMonth) ? selectedMonth : Object.keys(targets);
    const summed = {};
    monthKeys.forEach((mk) => {
      const mt = targets[mk];
      if (!mt) return;
      Object.entries(mt).forEach(([gk, gv]) => {
        if (!summed[gk]) summed[gk] = { sales: 0, revenue: 0 };
        summed[gk].sales += gv.sales || 0;
        summed[gk].revenue += gv.revenue || 0;
      });
    });
    return summed;
  }, [targets, selectedMonth]);

  /* Total target sales & revenue across all groups */
  const totalTargetSales = Object.values(monthTarget).reduce((s, g) => s + (g.sales || 0), 0);
  const totalTargetRevenue = Object.values(monthTarget).reduce((s, g) => s + (g.revenue || 0), 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 overflow-hidden flex flex-col" style={{ maxHeight: "600px" }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-lg">
          Agent × category matrix
        </h3>
        <span className="text-lg">📋</span>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Revenue per cell in AED. Hover Total column for group breakdown.
      </p>

      <div className="overflow-auto -mx-2 px-2 flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 z-20">
            <tr>
              <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2 pr-4 sticky left-0 bg-gray-900 z-20 min-w-[100px]">
                Agent
              </th>
              {categories.map((cat) => (
                <th
                  key={cat}
                  className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2 px-2 min-w-[80px]"
                >
                  {cat}
                </th>
              ))}
              <th className="text-center text-[11px] font-semibold text-emerald-400 uppercase tracking-wider py-2 px-2 min-w-[100px] border-l border-gray-700">
                Total Revenue
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAgents.map((agent, idx) => {
              const totalRev = agentTotals[agent];
              const agentGroups = agentGroupData?.[agent] || {};
              const agentSalesTotal = Object.values(salesData?.[agent] || {}).reduce((s, v) => s + v, 0);

              /* contribution % */
              const salesContrib = totalTargetSales > 0
                ? Math.round((agentSalesTotal / totalTargetSales) * 100)
                : 0;
              const revenueContrib = totalTargetRevenue > 0
                ? Math.round((totalRev / totalTargetRevenue) * 100)
                : 0;

              return (
                <tr key={agent} className="border-t border-gray-800/50">
                  <td className="py-2.5 pr-4 font-medium text-white sticky left-0 bg-gray-900 z-10 whitespace-nowrap">
                    {rankIcon(idx)} {agent}
                  </td>
                  {categories.map((cat) => {
                    const val = matrix[agent]?.[cat];
                    const hasValue = val !== undefined && val !== null && val !== 0;
                    return (
                      <td key={cat} className="py-2.5 px-2 text-center">
                        {hasValue ? (
                          <span
                            className="inline-block px-2.5 py-1 rounded-md text-xs font-medium tabular-nums"
                            style={{
                              backgroundColor: getCellBg(val, maxVal),
                              color: val < 0 ? "#ef4444" : "#e5e7eb",
                            }}
                          >
                            {fmt(val)}
                          </span>
                        ) : (
                          <span className="text-gray-700">·</span>
                        )}
                      </td>
                    );
                  })}
                  {/* Total Revenue column */}
                  <td className="py-2.5 px-2 text-center border-l border-gray-800/50 relative">
                    <span
                      className="inline-block px-3 py-1 rounded-md text-xs font-semibold tabular-nums cursor-pointer"
                      style={{
                        backgroundColor: getCellBg(totalRev, maxTotal),
                        color: totalRev < 0 ? "#ef4444" : "#10b981",
                      }}
                      onMouseEnter={(e) => handleHover(agent, e)}
                      onMouseLeave={handleLeave}
                    >
                      {fmt(totalRev)}
                    </span>

                    {/* Portal tooltip — renders at body level, never clipped */}
                    {hoveredAgent === agent && anchorEl && (
                      <PortalTooltip anchor={anchorEl}>
                      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 min-w-[260px] text-left">
                        <p className="text-white font-semibold text-sm mb-3">{agent}</p>

                        {/* Total Sales by group */}
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Sales</p>
                        {Object.entries(agentGroups).map(([gk, gv]) => (
                          <div key={gk} className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-300">{gv.label}</span>
                            <span className="text-white font-medium tabular-nums">{gv.sales}</span>
                          </div>
                        ))}

                        <div className="border-t border-gray-700 my-2" />

                        {/* Total Revenue by group */}
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Revenue</p>
                        {Object.entries(agentGroups).map(([gk, gv]) => (
                          <div key={gk} className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-300">{gv.label}</span>
                            <span className="text-emerald-400 font-medium tabular-nums">AED {fmt(gv.revenue)}</span>
                          </div>
                        ))}

                        <div className="border-t border-gray-700 my-2" />

                        {/* Total Profit by group */}
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Profit</p>
                        {Object.entries(agentGroups).map(([gk, gv]) => (
                          <div key={gk} className="flex justify-between text-xs mb-0.5">
                            <span className="text-gray-300">{gv.label}</span>
                            <span className={`font-medium tabular-nums ${gv.profit < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                              AED {fmt(gv.profit)}
                            </span>
                          </div>
                        ))}

                        <div className="border-t border-gray-700 my-2" />

                        {/* Contribution to achievement */}
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-400">Sales contribution</span>
                          <span className="text-amber-400 font-semibold">{salesContrib}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Revenue contribution</span>
                          <span className="text-amber-400 font-semibold">{revenueContrib}%</span>
                        </div>
                      </div>
                      </PortalTooltip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
