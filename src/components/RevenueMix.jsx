"use client";

const fmt = (n) => Number(n).toLocaleString();

export default function RevenueMix({ data }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-full">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-lg">Revenue mix</h3>
        <span className="text-lg">🔄</span>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Share of top-line by category. Hover any segment for the AED breakdown.
      </p>

      {/* Segmented bar */}
      <div className="flex w-full h-2.5 rounded-full overflow-hidden mb-6 gap-0.5">
        {data.map((d) => (
          <div
            key={d.name}
            className="h-full rounded-full"
            style={{
              width: `${d.percentage}%`,
              backgroundColor: d.color,
              minWidth: d.percentage > 0 ? "4px" : "0",
            }}
            title={`${d.name}: AED ${fmt(d.value)} (${d.percentage}%)`}
          />
        ))}
      </div>

      {/* Legend list */}
      <div className="space-y-3.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-sm text-gray-300 truncate">{d.name}</span>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <span className="text-sm text-gray-400 tabular-nums">
                AED {fmt(d.value)}
              </span>
              <span className="text-sm font-semibold text-emerald-400 w-14 text-right tabular-nums">
                {d.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
