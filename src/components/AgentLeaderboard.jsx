"use client";
import { useState } from "react";

const fmt = (n) => Number(n).toLocaleString();

const COLORS = [
  "#10b981", "#f59e0b", "#ec4899", "#3b82f6",
  "#8b5cf6", "#06b6d4", "#ef4444", "#14b8a6",
  "#f97316", "#a3e635",
];

function getInitials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getBarColor(margin) {
  if (margin >= 80) return "#10b981";
  if (margin >= 50) return "#14b8a6";
  if (margin >= 20) return "#f59e0b";
  return "#ef4444";
}

function getRankBadge(rank) {
  if (rank === 0) return "🏆";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return null;
}

export default function AgentLeaderboard({ data }) {
  const [showAll, setShowAll] = useState(false);
  if (!data || data.length === 0) return null;

  const maxProfit = Math.max(...data.map((d) => Math.abs(d.profit)), 1);
  const visible = showAll ? data : data.slice(0, 10);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-lg">
          Agent leaderboard
        </h3>
        <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full">
          {visible.length} of {data.length}
        </span>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Ranked by net profit. Margin band colours the bar.
      </p>

      <div className="space-y-3">
        {visible.map((agent, i) => {
          const barWidth = Math.max((Math.abs(agent.profit) / maxProfit) * 100, 4);
          const barColor = getBarColor(agent.margin);
          const badge = getRankBadge(i);
          return (
            <div key={agent.name} className="flex items-center gap-3">
              {/* Initials circle */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] + "30", color: COLORS[i % COLORS.length] }}
              >
                {getInitials(agent.name)}
              </div>

              {/* Name + deal count */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {badge && <span className="text-sm">{badge}</span>}
                  <span className="text-sm font-medium text-white truncate">
                    {agent.name}
                  </span>
                  <span className="text-xs text-gray-500">· {agent.deals}</span>
                </div>
                {/* Bar */}
                <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1.5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>

              {/* Margin + profit */}
              <div className="text-right flex-shrink-0 ml-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: barColor }}
                >
                  {agent.margin}%
                </span>
                <p className="text-sm font-semibold text-white tabular-nums">
                  AED {fmt(agent.profit)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {data.length > 10 && (
        <button
          onClick={() => setShowAll((p) => !p)}
          className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
        >
          {showAll ? "Show top 10" : `Show all ${data.length} agents`}
        </button>
      )}
    </div>
  );
}
