"use client";

import { Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ==========================================
// 1. CUSTOM TOOLTIP
// ==========================================
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-600 rounded px-3 py-2 shadow-lg">
        {label && <p className="text-sm font-bold text-slate-200 mb-1">{label}</p>}
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

// ==========================================
// 2. HEATMAP CHART
// ==========================================
interface HeatmapChartProps {
  data: Array<{ DAY_OF_WEEK: number | string; HOUR_OF_DAY: number | string; QUERY_COUNT: number | string }>;
  height?: number;
}

export function HeatmapChart({ data, height = 360 }: HeatmapChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-96 flex items-center justify-center text-slate-500">No data available</div>;
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const grid = Array(7).fill(null).map(() => Array(24).fill(0));
  let maxValue = 0;

  const toNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeDayIndex = (value: unknown): number | null => {
    if (typeof value === "string") {
      const s = value.trim().toLowerCase();
      const byName: Record<string, number> = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5, sat: 6, saturday: 6,
      };
      if (s in byName) return byName[s];
    }
    const n = toNumber(value);
    if (n === null) return null;
    if (n >= 0 && n <= 6) return Math.trunc(n);
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
    grid[dayIdx][hourIdx] += count;
    maxValue = Math.max(maxValue, grid[dayIdx][hourIdx]);
  });

  // PROFESSIONAL UPDATE: "Ocean" sequential color map
  const colorStops = ["#0f172a", "#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];
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

  const margin = { top: 16, right: 16, bottom: 40, left: 54 }; 
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
          {/* PROFESSIONAL UPDATE: Matched Legend Colors to the Ocean Theme */}
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-[#1e3a8a] rounded-sm"></div>
            <span className="text-slate-300">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-[#3b82f6] rounded-sm"></div>
            <span className="text-slate-300">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-[#93c5fd] rounded-sm"></div>
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
          >
            <rect x={0} y={0} width={svgW} height={svgH} fill="transparent" />

            {hours.map((h) => (
              <text key={`x-${h}`} x={margin.left + h * cellW + cellW / 2} y={margin.top - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {h}
              </text>
            ))}

            {days.map((day, dayIdx) => (
              <text key={`y-${day}`} x={margin.left - 6} y={margin.top + dayIdx * cellH + cellH / 2 + 3} textAnchor="end" fontSize="11" fill="#cbd5e1">
                {day}
              </text>
            ))}

            {grid.map((row, dayIdx) =>
              row.map((value, hourIdx) => {
                const x = margin.left + hourIdx * cellW;
                const y = margin.top + dayIdx * cellH;
                return (
                  <g key={`${dayIdx}-${hourIdx}`}>
                    <rect x={x} y={y} width={cellW - 1} height={cellH - 1} rx={2} fill={interpolateColor(value)} stroke="rgba(148,163,184,0.10)">
                      <title>{`${days[dayIdx]} ${hourIdx}:00 - ${value} queries`}</title>
                    </rect>
                    {value > 0 && value === maxValue && (
                      <text x={x + cellW / 2} y={y + cellH / 2 + 3} textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="700">
                        {Math.round(value)}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            <text x={margin.left + chartW / 2} y={svgH - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#cbd5e1" className="uppercase tracking-wider">
              Hour of Day
            </text>
            
            <text x={-(margin.top + chartH / 2)} y={15} transform="rotate(-90)" textAnchor="middle" fontSize="12" fontWeight="600" fill="#cbd5e1" className="uppercase tracking-wider">
              Day of Week
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// 3. DUAL AXIS CHART
// ==========================================
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
    <div className="w-full flex flex-col items-center">
      
      {/* 1. Hardcoded Custom Legend */}
      <div className="flex justify-center gap-6 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          {/* PROFESSIONAL UPDATE: Legend dot matches Deep Blue */}
          <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div>
          {barLabel || barKey}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          {/* PROFESSIONAL UPDATE: Legend dot matches Rose Red */}
          <div className="w-3 h-3 rounded-full bg-[#fb7185]"></div>
          {lineLabel || lineKey}
        </div>
      </div>

      <div className="flex w-full items-center">
        
        <div className="flex items-center justify-center w-8">
          <span className="text-slate-400 text-xs font-bold tracking-wider -rotate-90 whitespace-nowrap">
            {barLabel || barKey}
          </span>
        </div>

        <div className="flex-1" style={{ height: height - 60 }}>
<ResponsiveContainer width="100%" height="100%">
  <ComposedChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 20 }}>
    
    {/* 1. ADDED THE PURPLE GRADIENT DEFINITION */}
    <defs>
      <linearGradient id="purpleTrendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4} />
      </linearGradient>
    </defs>

    <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
    
    <XAxis 
      dataKey={xKey} 
      angle={-35} 
      textAnchor="end" 
      height={60} 
      minTickGap={20} 
      tick={{ fill: '#94a3b8', fontSize: 11 }} 
      stroke="#64748b" 
      tickLine={false}
      axisLine={{ stroke: '#475569' }}
      dy={10} 
    />
    
    <YAxis yAxisId="left" stroke="#64748b" tickLine={false} axisLine={{ stroke: '#475569' }} tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
    <YAxis yAxisId="right" orientation="right" stroke="#64748b" tickLine={false} axisLine={{ stroke: '#475569' }} tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
    
    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
    
    {/* 2. CHANGED FILL TO PURPLE GRADIENT */}
    <Bar 
      yAxisId="left" 
      dataKey={barKey} 
      fill="url(#purpleTrendGrad)" 
      name={barLabel || barKey} 
      radius={[4, 4, 0, 0]} 
      maxBarSize={40}
    />
    
    {/* RED LINE STAYS EXACTLY THE SAME */}
    <Line
      yAxisId="right"
      type="monotone"
      dataKey={lineKey}
      stroke="#ef4444"
      strokeWidth={3}
      dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
      activeDot={{ r: 6, fill: '#ef4444', strokeWidth: 0, stroke: '#ffffff' }}
      name={lineLabel || lineKey}
    />
  </ComposedChart>
</ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center w-8">
          <span className="text-slate-400 text-xs font-bold tracking-wider rotate-90 whitespace-nowrap">
            {lineLabel || lineKey}
          </span>
        </div>
      </div>

      <div className="w-full text-center mt-2">
        <span className="text-slate-400 text-xs font-bold tracking-wider uppercase">
          Timeline
        </span>
      </div>

    </div>
  );
}