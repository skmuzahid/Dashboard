"use client";
import { useState, useMemo } from "react";

const fmt = (n) => Number(n).toLocaleString();

export default function DealLedger({ deals, categories }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [lossOnly, setLossOnly] = useState(false);
  const [sortCol, setSortCol] = useState("profit");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    let rows = deals || [];

    /* search */
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.agent.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.ratePlan.toLowerCase().includes(q)
      );
    }

    /* category filter */
    if (catFilter !== "All") {
      rows = rows.filter((r) => r.category === catFilter);
    }

    /* loss only */
    if (lossOnly) {
      rows = rows.filter((r) => r.profit < 0);
    }

    /* sort */
    rows = [...rows].sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [deals, search, catFilter, lossOnly, sortCol, sortDir]);

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="text-gray-600 ml-1">↕</span>;
    return (
      <span className="text-emerald-400 ml-1">
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  const allCats = categories || [];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <div>
            <h3 className="text-white font-semibold text-lg">Deal ledger</h3>
            <p className="text-gray-500 text-sm">
              {filtered.length} of {(deals || []).length} deals shown. Click
              column headers to sort.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search agents, categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-56 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          {/* Category dropdown */}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer"
          >
            <option value="All">All categories</option>
            {allCats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Loss toggle */}
          <button
            onClick={() => setLossOnly((p) => !p)}
            className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
              lossOnly
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            📉 Loss only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto" style={{ maxHeight: "480px" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-800">
              {[
                { key: "month", label: "MONTH" },
                { key: "agent", label: "AGENT" },
                { key: "category", label: "CATEGORY" },
                { key: "revenue", label: "REVENUE", align: "right" },
                { key: "commissionAmount", label: "COMMISSION", align: "right" },
                { key: "profit", label: "PROFIT", align: "right" },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`py-3 px-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase cursor-pointer hover:text-gray-300 select-none ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr
                key={i}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="py-3 px-3 text-gray-400">{d.month}</td>
                <td className="py-3 px-3 font-medium text-white">{d.agent}</td>
                <td className="py-3 px-3 text-gray-400">{d.category}</td>
                <td className="py-3 px-3 text-right text-gray-300 tabular-nums">
                  AED {fmt(d.revenue)}
                </td>
                <td className="py-3 px-3 text-right text-gray-300 tabular-nums">
                  {d.commissionAmount ? `AED ${fmt(d.commissionAmount)}` : "—"}
                </td>
                <td
                  className={`py-3 px-3 text-right font-semibold tabular-nums ${
                    d.profit < 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  AED {fmt(d.profit)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  No deals match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
