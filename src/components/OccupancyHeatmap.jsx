import { useMemo } from 'react';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_LABELS = [
  '12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a',
  '12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p'
];

function getHeatColor(value, max) {
  if (max === 0) return 'rgba(99, 102, 241, 0.05)';
  const intensity = value / max;
  if (intensity < 0.2) return 'rgba(34, 197, 94, 0.25)';
  if (intensity < 0.4) return 'rgba(34, 197, 94, 0.5)';
  if (intensity < 0.6) return 'rgba(250, 204, 21, 0.5)';
  if (intensity < 0.8) return 'rgba(249, 115, 22, 0.6)';
  return 'rgba(239, 68, 68, 0.7)';
}

export default function OccupancyHeatmap({ data }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No heatmap data available</div>;
  }

  const { grid, maxRate } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(null));
    let max = 0;
    data.forEach(d => {
      const dayIdx = d.dayOfWeek - 1; // 1=Mon -> 0
      if (dayIdx >= 0 && dayIdx < 7 && d.hourOfDay >= 0 && d.hourOfDay < 24) {
        g[dayIdx][d.hourOfDay] = d.averageRate;
        if (d.averageRate > max) max = d.averageRate;
      }
    });
    return { grid: g, maxRate: max };
  }, [data]);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Occupancy Heatmap</h3>
      <p className="chart-subtitle">Average occupancy by day of week & hour</p>
      <div className="heatmap-container">
        {/* Hour headers */}
        <div className="heatmap-row heatmap-header">
          <div className="heatmap-day-label"></div>
          {HOUR_LABELS.map((h, i) => (
            <div key={i} className="heatmap-hour-label">{i % 3 === 0 ? h : ''}</div>
          ))}
        </div>
        {/* Data rows */}
        {grid.map((row, dayIdx) => (
          <div key={dayIdx} className="heatmap-row">
            <div className="heatmap-day-label">{DAY_LABELS[dayIdx]}</div>
            {row.map((value, hourIdx) => (
              <div
                key={hourIdx}
                className="heatmap-cell"
                style={{ backgroundColor: value !== null ? getHeatColor(value, maxRate) : 'rgba(255,255,255,0.03)' }}
                title={value !== null ? `${DAY_LABELS[dayIdx]} ${HOUR_LABELS[hourIdx]}: ${value.toFixed(1)}%` : 'No data'}
              >
                {value !== null && value >= maxRate * 0.5 && (
                  <span className="heatmap-cell-text">{Math.round(value)}</span>
                )}
              </div>
            ))}
          </div>
        ))}
        {/* Legend */}
        <div className="heatmap-legend">
          <span className="heatmap-legend-label">Low</span>
          <div className="heatmap-legend-bar" />
          <span className="heatmap-legend-label">High</span>
        </div>
      </div>
    </div>
  );
}
