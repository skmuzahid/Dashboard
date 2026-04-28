"use client";

const fmt = (n) => Number(n).toLocaleString();

function getCellBg(value, maxVal) {
  if (value === undefined || value === null) return "transparent";
  if (value < 0) return "rgba(239, 68, 68, 0.15)";
  const intensity = Math.min(Math.abs(value) / (maxVal || 1), 1);
  return `rgba(139, 92, 246, ${0.08 + intensity * 0.35})`;
}

export default function AgentCategoryMatrix({ data }) {
  if (!data || !data.agents || data.agents.length === 0) return null;

  const { agents, categories, data: matrix } = data;

  /* find max value for heat-map intensity */
  let maxVal = 0;
  agents.forEach((agent) => {
    categories.forEach((cat) => {
      const v = matrix[agent]?.[cat];
      if (v !== undefined && Math.abs(v) > maxVal) maxVal = Math.abs(v);
    });
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold text-lg">
          Agent × category matrix
        </h3>
        <span className="text-lg">📋</span>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Profit per cell in AED. Hover for revenue and margin details.
      </p>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2 pr-4 sticky left-0 bg-gray-900 z-10 min-w-[100px]">
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
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent} className="border-t border-gray-800/50">
                <td className="py-2.5 pr-4 font-medium text-white sticky left-0 bg-gray-900 z-10">
                  {agent}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
