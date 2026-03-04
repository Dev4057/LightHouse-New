'use client'

import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts'
import useFetch from '@/hooks/useApi'
import { Loader } from 'lucide-react'
import { useSpendDisplay } from '@/hooks/useSpendDisplay'

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

// CUSTOM TICK COMPONENT: Truncates long labels and adds a native hover tooltip
const CustomXAxisTick = ({ x, y, payload }: any) => {
  const text = payload.value;
  // If the text is longer than 11 characters, truncate it and add "..."
  const truncatedText = text.length > 11 ? `${text.substring(0, 9)}...` : text;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {/* The <title> tag creates the native browser hover tooltip */}
        <title>{text}</title>
        {truncatedText}
      </text>
    </g>
  );
};

export default function ChartsGrid({ dateRange }: { dateRange: { start: Date; end: Date } }) {
  const start = dateRange.start.toISOString().split('T')[0]
  const end = dateRange.end.toISOString().split('T')[0]

  const { data: trend, isLoading: l1 } = useFetch<any[]>(
    ['dash-trend', start, end],
    `/api/queries?type=trend&start=${start}&end=${end}`
  )
  const { data: whCredits, isLoading: l2 } = useFetch<any[]>(
    ['dash-wh-credits', start, end],
    `/api/warehouses?type=credits&start=${start}&end=${end}`
  )
  const { data: serviceCredits, isLoading: l3 } = useFetch<any[]>(
    ['dash-service-credits', start, end],
    `/api/warehouses?type=services&start=${start}&end=${end}`
  )
  const { convertCredits, formatCreditValue, creditUnitLabel } = useSpendDisplay()

  if (l1 || l2 || l3) {
    return (
      <div className="card glass flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  // Calculate Average Credits for the Reference Line
  const processedTrendData = (trend || []).map((row) => ({
    ...row,
    TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS),
  }));
  const avgCredits = processedTrendData.length > 0 
    ? processedTrendData.reduce((acc, curr) => acc + curr.TOTAL_SPEND_DISPLAY, 0) / processedTrendData.length 
    : 0;

  // Calculate Maximum Warehouse Credits for Inline Progress Bars
  const topWarehouses = (whCredits || []).slice(0, 6);
  const maxWhCredits = topWarehouses.length > 0 
    ? Math.max(...topWarehouses.map((w) => Number(w.TOTAL_CREDITS_USED || 0))) 
    : 1;

  // Custom Glassy Tooltip Style for Recharts
  const glassTooltipStyle = {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
    color: '#f8fafc'
  };

  return (
    <div className="space-y-6">
      
      {/* 1. UPGRADED COMPOSED CHART: Credits & Query Trends */}
{/* 1. PROFESSIONAL DUAL-AXIS BAR CHART: Credits & Query Trends */}
      <div className="chart-container group relative">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-2">{creditUnitLabel} & Query Trends</h3>
        
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={processedTrendData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
            
            {/* Premium Vertical Gradients for the Bars */}
            <defs>
              <linearGradient id="barCredits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>   {/* Bright Blue top */}
                <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.6}/> {/* Dark Blue bottom */}
              </linearGradient>
              <linearGradient id="barQueries" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity={1}/>   {/* Bright Teal top */}
                <stop offset="100%" stopColor="#115e59" stopOpacity={0.6}/> {/* Dark Teal bottom */}
              </linearGradient>
            </defs>

            {/* Subtle horizontal grid lines */}
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            
            {/* Timeline X-Axis */}
            <XAxis 
              dataKey="QUERY_DAY" 
              stroke="#64748b" 
              axisLine={{ stroke: '#475569', strokeWidth: 1.5 }}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }} 
              dy={10} 
            />
            
            {/* Left Y-Axis (Credits) */}
            <YAxis 
              yAxisId="left" 
              stroke="#3b82f6" /* Tinted axis line to match the blue bar */
              axisLine={{ stroke: '#3b82f6', strokeWidth: 1.5, strokeOpacity: 0.5 }}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }} 
              width={60} 
            />
            
            {/* Right Y-Axis (Queries) */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#2dd4bf" /* Tinted axis line to match the teal bar */
              axisLine={{ stroke: '#2dd4bf', strokeWidth: 1.5, strokeOpacity: 0.5 }}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }} 
              width={60} 
            />
            
            {/* Frosted Glass Tooltip with Hover Background */}
            <Tooltip
              contentStyle={glassTooltipStyle}
              itemStyle={{ color: '#e2e8f0', fontWeight: 600 }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }} /* Highlights the background behind the grouped bars */
              formatter={(value, name) => {
                if (name === 'Credits Used' || name === 'USD Used') {
                  return [formatCreditValue(Number(value)), name]
                }
                return [value as any, name]
              }}
            />
            
            <Legend wrapperStyle={{ paddingTop: '10px', paddingBottom: '20px', fontSize: '12px' }} verticalAlign="top" />
            
            {/* Left Bar: Credits Used */}
            <Bar
              yAxisId="left"
              dataKey="TOTAL_SPEND_DISPLAY"
              name={`${creditUnitLabel} Used`}
              fill="url(#barCredits)"
              radius={[4, 4, 0, 0]} /* Rounds the top left and top right corners */
              maxBarSize={40} /* Prevents bars from looking comically wide if there are only 2 or 3 days of data */
            />

            {/* Right Bar: Query Count */}
            <Bar
              yAxisId="right"
              dataKey="QUERY_COUNT"
              name="Query Count"
              fill="url(#barQueries)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. UPGRADED: Credits by Warehouse (Inline Progress Bars) */}
        <div className="chart-container group flex flex-col">
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">{creditUnitLabel} by Warehouse</h3>
          
          <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-md rounded-xl p-5 shadow-inner flex-1 flex flex-col justify-center">
            <div className="space-y-4">
              {topWarehouses.map((item, idx) => {
                const val = Number(item.TOTAL_CREDITS_USED || 0);
                const pct = Math.min(100, Math.max(0.5, (val / maxWhCredits) * 100));
                const color = COLORS[idx % COLORS.length];

                return (
                  <div key={idx} className="group/item relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover/item:scale-125" 
                          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                        />
                        <p className="text-sm font-medium text-slate-200 truncate group-hover/item:text-white transition-colors">
                          {item.WAREHOUSE_NAME}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-white flex-shrink-0">
                        {formatCreditValue(val)}
                      </p>
                    </div>
                    
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out relative"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      >
                        <div className="absolute inset-0 bg-white/20 w-full h-full opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. BAR CHART: Credits by Service Type */}
        <div className="chart-container group">
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider mb-4">{creditUnitLabel} by Service Type</h3>
          
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={(serviceCredits || []).slice(0, 10).map((row) => ({
                ...row,
                TOTAL_SPEND_DISPLAY: convertCredits(row.TOTAL_CREDITS),
              }))}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorServiceBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              
           <XAxis 
  dataKey="SERVICE_TYPE" 
  stroke="#64748b" 
  axisLine={{ stroke: '#475569', strokeWidth: 1.5 }}
  tickLine={{ stroke: '#475569', strokeWidth: 1.5 }}
  height={50} 
  dy={10} 
  tick={{ fill: '#94a3b8', fontSize: 11 }} 
  // 1. We removed the angle so it stays straight
  // 2. This formatter automatically cuts long names and adds "..."
  tickFormatter={(value) => 
    typeof value === 'string' && value.length > 10 
      ? `${value.substring(0, 10)}...` 
      : value
  }
/>
              <YAxis 
                stroke="#64748b" 
                axisLine={{ stroke: '#475569', strokeWidth: 1.5 }}
                tickLine={{ stroke: '#475569', strokeWidth: 1.5 }}
                tick={{ fill: '#94a3b8', fontSize: 11 }} 
              />
              
              <Tooltip
                contentStyle={glassTooltipStyle}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                formatter={(value) => formatCreditValue(Number(value))}
              />
              
              <Bar 
                dataKey="TOTAL_SPEND_DISPLAY" 
                fill="url(#colorServiceBar)" 
                radius={[4, 4, 0, 0]} 
                name={`${creditUnitLabel} Used`}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}