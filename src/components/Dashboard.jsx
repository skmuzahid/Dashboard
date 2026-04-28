"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import KPICards from "./KPICards";
import CategoryChart from "./CategoryChart";
import RevenueMix from "./RevenueMix";
import AgentLeaderboard from "./AgentLeaderboard";
import AgentCategoryMatrix from "./AgentCategoryMatrix";
import DealLedger from "./DealLedger";
import { processData } from "@/lib/dataProcessing";

const REFRESH_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
];

export default function Dashboard({ user }) {
  const [rawData, setRawData] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [autoRefresh, setAutoRefresh] = useState(15);
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState(null);

  /** Fetch JSON from Apps Script directly (browser → Google, no Vercel server) */
  const fetchData = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        setError(null);

        const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
        if (!scriptUrl) throw new Error("Apps Script URL not configured");

        const sep = scriptUrl.includes("?") ? "&" : "?";
        const opts = {};
        if (signal instanceof AbortSignal) opts.signal = signal;

        const res = await fetch(`${scriptUrl}${sep}t=${Date.now()}`, opts);

        if (!res.ok) throw new Error(`Apps Script returned ${res.status}`);

        const text = await res.text();

        /* Detect if corporate proxy returned an HTML block page */
        if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
          throw new Error(
            "Received an HTML page instead of data. Your network may be blocking Google. Try disconnecting from VPN."
          );
        }

        const rows = JSON.parse(text);
        if (!signal?.aborted) {
          setRawData(rows);
          setLastSynced(new Date());
        }
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    []
  );

  /* Reprocess whenever rawData or selectedMonth changes (instant, no fetch) */
  useEffect(() => {
    if (rawData) {
      setData(processData(rawData, selectedMonth));
    }
  }, [rawData, selectedMonth]);

  /* Initial load */
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  /* Auto-refresh interval */
  useEffect(() => {
    if (autoRefresh === 0) return;
    const id = setInterval(fetchData, autoRefresh * 60 * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const months = data?.months || [];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ─── Header ─── */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Brand */}
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1 rounded-full">
              ✦ Zavis · Consumer Sales
            </span>

            {/* Month pills */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setSelectedMonth("All")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedMonth === "All"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                All
              </button>
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    selectedMonth === m
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh selector */}
            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(Number(e.target.value))}
              title="Auto-refresh interval"
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:outline-none cursor-pointer"
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  ⏱ {o.label}
                </option>
              ))}
            </select>

            {/* Refresh button */}
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh data now"
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-1.5"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              Refresh
            </button>

            {/* User + sign out */}
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-800">
              <span className="text-xs text-gray-400">{user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-xs text-gray-500 hover:text-rose-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Title section */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Sales intelligence dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Consolidated revenue, profit, and agent performance view. All
            figures in <span className="text-white font-medium">AED</span>.
            {lastSynced && (
              <>
                {" "}
                Last synced{" "}
                {lastSynced.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                ,{" "}
                {lastSynced.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </>
            )}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-4 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-[130px] animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Dashboard content */}
        {data && (
          <>
            {/* KPI Cards */}
            <KPICards data={data.kpis} />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <CategoryChart data={data.categoryPerformance} />
              </div>
              <div>
                <RevenueMix data={data.revenueMix} />
              </div>
            </div>

            {/* Agent row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AgentLeaderboard data={data.agentLeaderboard} />
              <AgentCategoryMatrix data={data.agentCategoryMatrix} />
            </div>

            {/* Deal ledger */}
            <DealLedger
              deals={data.dealLedger}
              categories={data.categories}
            />
          </>
        )}
      </main>
    </div>
  );
}
