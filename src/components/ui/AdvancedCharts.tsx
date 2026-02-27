"use client";

import { Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface HeatmapChartProps {
  data: Array<{ DAY_OF_WEEK: number | string; HOUR_OF_DAY: number | string; QUERY_COUNT: number | string }>;
  height?: number;
}

// Custom tooltip for Recharts with better styling
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-600 rounded px-3 py-2 shadow-lg">
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function HeatmapChart({ data, height = 360 }: HeatmapChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-96 flex items-center justify-center text-slate-500">No data available</div>;
  }

  // Streamlit uses a pivot over DAY_OF_WEEK x HOUR_OF_DAY and fills missing cells with 0.
  // The mart can expose day values as 0-6, 1-7, or text labels depending on pipeline/version,
  // so normalize here before building the 7x24 grid.
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const grid = Array(7)
    .fill(null)
    .map(() => Array(24).fill(0));
  let maxValue = 0;

  const toNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeDayIndex = (value: unknown): number | null => {
    if (typeof value === "string") {
      const s = value.trim().toLowerCase();
      const byName: Record<string, number> = {
        sun: 0, sunday: 0,
        mon: 1, monday: 1,
        tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5,
        sat: 6, saturday: 6,
      };
      if (s in byName) return byName[s];
    }

    const n = toNumber(value);
    if (n === null) return null;
    // Accept common encodings:
    // 0..6 => Sunday..Saturday
    if (n >= 0 && n <= 6) return Math.trunc(n);
    // 1..7 => Monday..Sunday (common SQL DOW encoding)
    if (n >= 1 && n <= 7) return n === 7 ? 0 : Math.trunc(n);
    return null;
  };

  data.forEach((d) => {
    const dayIdx = normalizeDayIndex(d.DAY_OF_WEEK);
    const hour = toNumber(d.HOUR_OF_DAY);
    const count = toNumber(d.QUERY_COUNT);
    if (dayIdx === null || hour === null || count === null) return;
    if (hour < 0 || hour > 23) return;

    const hourIdx = Math.trunc(hour);
    // Sum values to mirror pivot_table(..., aggfunc="sum") in Streamlit.
    grid[dayIdx][hourIdx] += count;
    maxValue = Math.max(maxValue, grid[dayIdx][hourIdx]);
  });

  const colorStops = ["#0f172a", "#1d4ed8", "#38bdf8", "#facc15", "#fb923c", "#ef4444"];
  const interpolateColor = (value: number) => {
    if (value <= 0 || maxValue <= 0) return "#0f172a";
    const t = Math.max(0, Math.min(1, value / maxValue));
    const scaled = t * (colorStops.length - 1);
    const i = Math.floor(scaled);
    const frac = scaled - i;
    const c1 = colorStops[Math.min(i, colorStops.length - 1)];
    const c2 = colorStops[Math.min(i + 1, colorStops.length - 1)];
    const hexToRgb = (hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    });
    const a = hexToRgb(c1);
    const b = hexToRgb(c2);
    const mix = (x: number, y: number) => Math.round(x + (y - x) * frac);
    return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
  };

  const margin = { top: 16, right: 16, bottom: 30, left: 44 };
  const cellW = 20;
  const cellH = 24;
  const chartW = 24 * cellW;
  const chartH = 7 * cellH;
  const svgW = margin.left + chartW + margin.right;
  const svgH = margin.top + chartH + margin.bottom;

  return (
    <div className="w-full p-4 bg-slate-950/40 rounded-lg border border-slate-700" style={{ minHeight: height }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-100">Query Volume by Day & Hour</h3>
        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-blue-200"></div>
            <span className="text-slate-300">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-yellow-400"></div>
            <span className="text-slate-300">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-red-500"></div>
            <span className="text-slate-300">High</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: svgW }}>
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ height: Math.max(220, height - 72) }}
            role="img"
            aria-label="Heatmap of query volume by day of week and hour of day"
          >
            <rect x={0} y={0} width={svgW} height={svgH} fill="transparent" />

            {hours.map((h) => (
              <text
                key={`x-${h}`}
                x={margin.left + h * cellW + cellW / 2}
                y={margin.top - 4}
                textAnchor="middle"
                fontSize="10"
                fill="#94a3b8"
              >
                {h}
              </text>
            ))}

            {days.map((day, dayIdx) => (
              <text
                key={`y-${day}`}
                x={margin.left - 6}
                y={margin.top + dayIdx * cellH + cellH / 2 + 3}
                textAnchor="end"
                fontSize="11"
                fill="#cbd5e1"
              >
                {day}
              </text>
            ))}

            {grid.map((row, dayIdx) =>
              row.map((value, hourIdx) => {
                const x = margin.left + hourIdx * cellW;
                const y = margin.top + dayIdx * cellH;
                return (
                  <g key={`${dayIdx}-${hourIdx}`}>
                    <rect
                      x={x}
                      y={y}
                      width={cellW - 1}
                      height={cellH - 1}
                      rx={2}
                      fill={interpolateColor(value)}
                      stroke="rgba(148,163,184,0.10)"
                    >
                      <title>{`${days[dayIdx]} ${hourIdx}:00 - ${value} queries`}</title>
                    </rect>
                    {value > 0 && value === maxValue && (
                      <text
                        x={x + cellW / 2}
                        y={y + cellH / 2 + 3}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#ffffff"
                        fontWeight="700"
                      >
                        {Math.round(value)}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            <text x={margin.left + chartW / 2} y={svgH - 4} textAnchor="middle" fontSize="11" fill="#94a3b8">
              Hour
            </text>
          </svg>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-300">
        <span className="text-slate-400">Queries</span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 12 }, (_, i) => {
            const v = (maxValue * i) / 11;
            return <div key={i} className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: interpolateColor(v) }} />;
          })}
        </div>
        <span className="text-slate-500">0</span>
        <span className="text-slate-500">to</span>
        <span className="text-slate-200">{Math.round(maxValue)}</span>
      </div>
    </div>
  );
}

interface DualAxisChartProps {
  data: Array<{ [key: string]: any }>;
  xKey: string;
  barKey: string;
  lineKey: string;
  barLabel?: string;
  lineLabel?: string;
  height?: number;
}

export function DualAxisChart({ data, xKey, barKey, lineKey, barLabel, lineLabel, height = 360 }: DualAxisChartProps) {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ left: 4, right: 8, top: 12, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis
            dataKey={xKey}
            angle={-35}
            textAnchor="end"
            height={64}
            minTickGap={20}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#94a3b8"
          />
          <YAxis yAxisId="left" stroke="#94a3b8" width={52} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" width={44} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={24}
            iconType="circle"
            wrapperStyle={{ color: '#cbd5e1', fontSize: '12px', paddingBottom: '2px' }}
          />
          <Bar yAxisId="left" dataKey={barKey} fill="#3b82f6" name={barLabel || barKey} radius={[2, 2, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={lineKey}
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            name={lineLabel || lineKey}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
