"use client";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PURPLES = [
  "#8b5cf6", "#7c3aed", "#a78bfa", "#6d28d9",
  "#c4b5fd", "#9333ea", "#7e22ce", "#6366f1",
  "#818cf8", "#5b21b6",
];

const fmt = (n) => Number(n).toLocaleString();

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm">
      <p className="font-semibold text-white mb-1">{d.name}</p>
      <p className="text-gray-300">Revenue: AED {fmt(d.revenue)}</p>
      <p className="text-gray-300">Profit: AED {fmt(d.profit)}</p>
      <p className="text-gray-300">Margin: {d.margin}%</p>
      <p className="text-gray-300">Deals: {d.count}</p>
    </div>
  );
}

export default function CategoryChart({ data }) {
  const [view, setView] = useState("revenue");
  if (!data || data.length === 0) return null;

  const yKey = view;
  const yLabel =
    view === "revenue" ? "AED" : view === "profit" ? "AED" : "%";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">
            Product category performance
          </h3>
          <p className="text-gray-500 text-sm mt-0.5">
            Toggle between revenue, profit, and margin. Hover any bar for the
            full breakdown.
          </p>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          {["revenue", "profit", "margin"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                view === v
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {v === "margin" ? "% Margin" : v === "revenue" ? "📊 Revenue" : "💰 Profit"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                view === "margin" ? `${v}%` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v
              }
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey={yKey} radius={[6, 6, 0, 0]} barSize={45}>
              {data.map((_, i) => (
                <Cell key={i} fill={PURPLES[i % PURPLES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
