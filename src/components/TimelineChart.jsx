import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{d.time}</p>
      <p className="tooltip-value">{d.occupancyRate.toFixed(1)}% occupancy</p>
      <p className="tooltip-detail">{d.occupiedSlots}/{d.totalSlots} slots occupied</p>
    </div>
  );
}

export default function TimelineChart({ data, onDateChange }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleApply = () => {
    if (from && to) {
      onDateChange(from, to);
    }
  };

  const chartData = (data || []).map(d => ({
    ...d,
    time: new Date(d.recordedAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }),
    shortTime: new Date(d.recordedAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric'
    }),
  }));

  return (
    <div className="chart-card">
      <div className="chart-header-row">
        <div>
          <h3 className="chart-title">Occupancy Timeline</h3>
          <p className="chart-subtitle">Historical occupancy over a date range</p>
        </div>
        <div className="date-picker-row">
          <div className="date-input-group">
            <label>From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="date-input-group">
            <label>To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="date-input"
            />
          </div>
          <button className="apply-btn" onClick={handleApply} disabled={!from || !to}>
            Apply
          </button>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="shortTime"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              interval={Math.max(Math.floor(chartData.length / 8), 1)}
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
              dataKey="occupancyRate"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#timelineGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#06b6d4', stroke: '#083344', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="chart-empty">Select a date range and click Apply</div>
      )}
    </div>
  );
}
