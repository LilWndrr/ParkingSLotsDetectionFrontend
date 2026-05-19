import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const HOUR_LABELS = [
  '12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM',
  '12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM'
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{HOUR_LABELS[d.hourOfDay]}</p>
      <p className="tooltip-value">{d.averageRate.toFixed(1)}% avg occupancy</p>
    </div>
  );
}

export default function HourlyOccupancyChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No hourly data available</div>;
  }

  const chartData = data.map(d => ({
    ...d,
    label: HOUR_LABELS[d.hourOfDay],
  }));

  return (
    <div className="chart-card">
      <h3 className="chart-title">Average Occupancy by Hour</h3>
      <p className="chart-subtitle">Across all recorded days</p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="averageRate"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#occupancyGradient)"
            dot={false}
            activeDot={{ r: 5, fill: '#6366f1', stroke: '#1e1b4b', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
