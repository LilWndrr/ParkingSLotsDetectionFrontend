import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';

const HOUR_LABELS = [
  '12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM',
  '12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM'
];

const COLORS = [
  '#6366f1','#8b5cf6','#a78bfa','#c084fc','#e879f9','#f472b6',
  '#fb7185','#f87171','#fb923c','#fbbf24','#a3e635','#34d399',
  '#22d3ee','#38bdf8','#60a5fa','#818cf8',
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{HOUR_LABELS[d.hourOfDay]}</p>
      {d.slots.map((s, i) => (
        <p key={i} className="tooltip-detail">
          <span className="tooltip-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
          {s.slotName}: {s.transitionCount} transitions
        </p>
      ))}
      <p className="tooltip-value">Total: {d.total} transitions</p>
    </div>
  );
}

export default function SlotTransitionsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No transition data available</div>;
  }

  // Group by hour, aggregate total transitions
  const chartData = useMemo(() => {
    const byHour = {};
    data.forEach(d => {
      if (!byHour[d.hourOfDay]) {
        byHour[d.hourOfDay] = { hourOfDay: d.hourOfDay, total: 0, slots: [] };
      }
      byHour[d.hourOfDay].total += d.transitionCount;
      byHour[d.hourOfDay].slots.push({ slotName: d.slotName, transitionCount: d.transitionCount });
    });
    return Array.from({ length: 24 }, (_, i) =>
      byHour[i] || { hourOfDay: i, total: 0, slots: [] }
    );
  }, [data]);

  const maxTotal = Math.max(...chartData.map(d => d.total), 1);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Slot State Transitions</h3>
      <p className="chart-subtitle">How often slots change state (empty ↔ occupied) per hour</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="hourOfDay"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickFormatter={(v) => HOUR_LABELS[v]?.replace(' AM','a').replace(' PM','p')}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((entry, idx) => {
              const intensity = entry.total / maxTotal;
              const color = intensity < 0.33 ? '#22d3ee' : intensity < 0.66 ? '#a78bfa' : '#f472b6';
              return <Cell key={idx} fill={color} fillOpacity={0.8} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
