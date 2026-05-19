import { useState, useEffect, useCallback } from 'react';
import HourlyOccupancyChart from '../components/HourlyOccupancyChart';
import OccupancyHeatmap from '../components/OccupancyHeatmap';
import TimelineChart from '../components/TimelineChart';
import SlotTransitionsChart from '../components/SlotTransitionsChart';
import SpatialHeatmap from '../components/SpatialHeatmap';
import {
  fetchHourlyOccupancy,
  fetchOccupancyByDayAndHour,
  fetchOccupancyByTimeInterval,
  fetchSlotTransitions,
  fetchGroundLevels,
} from '../api/occupancy';

export default function Dashboard() {
  const [levels, setLevels] = useState([]);
  const [levelId, setLevelId] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [error, setError] = useState(null);

  const [hourlyData, setHourlyData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [transitionData, setTransitionData] = useState([]);

  const loadData = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const [hourly, heatmap, transitions] = await Promise.allSettled([
        fetchHourlyOccupancy(id),
        fetchOccupancyByDayAndHour(id),
        fetchSlotTransitions(id),
      ]);

      setHourlyData(hourly.status === 'fulfilled' ? hourly.value || [] : []);
      setHeatmapData(heatmap.status === 'fulfilled' ? heatmap.value || [] : []);
      setTransitionData(transitions.status === 'fulfilled' ? transitions.value || [] : []);
      setTimelineData([]);
    } catch (err) {
      setError('Failed to load analytics data. Make sure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch ground levels on mount
  useEffect(() => {
    setLoadingLevels(true);
    fetchGroundLevels()
      .then(data => setLevels(data || []))
      .catch(() => setLevels([]))
      .finally(() => setLoadingLevels(false));
  }, []);

  const handleLevelChange = (e) => {
    const id = e.target.value;
    if (!id) return;
    const level = levels.find(l => l.id === id);
    setLevelId(id);
    setSelectedName(level ? level.name : id);
    setSelectedImageUrl(level?.imageUrl || '');
    loadData(id);
  };

  const handleDateChange = async (from, to) => {
    if (!levelId) return;
    try {
      const data = await fetchOccupancyByTimeInterval(levelId, from, to);
      setTimelineData(data || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setTimelineData([]);
    }
  };

  // Summary stats
  const avgOccupancy = hourlyData.length > 0
    ? (hourlyData.reduce((sum, d) => sum + d.averageRate, 0) / hourlyData.length).toFixed(1)
    : '—';
  const peakHour = hourlyData.length > 0
    ? hourlyData.reduce((max, d) => d.averageRate > max.averageRate ? d : max, hourlyData[0])
    : null;
  const quietHour = hourlyData.length > 0
    ? hourlyData.reduce((min, d) => d.averageRate < min.averageRate ? d : min, hourlyData[0])
    : null;
  const totalTransitions = transitionData.reduce((sum, d) => sum + d.transitionCount, 0);

  const HOUR_LABELS = [
    '12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM','8 AM','9 AM','10 AM','11 AM',
    '12 PM','1 PM','2 PM','3 PM','4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM'
  ];

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div>
            <h1 className="header-title">Parking Analytics</h1>
            <p className="header-subtitle">Real-time occupancy intelligence</p>
          </div>
        </div>
        <div className="header-right">
          <div className="connect-group">
            <select
              value={levelId}
              onChange={handleLevelChange}
              className="level-select"
              disabled={loadingLevels}
            >
              <option value="">
                {loadingLevels ? 'Loading levels...' : 'Select Ground Level'}
              </option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {loading && <span className="spinner" />}
          </div>
          {levelId && (
            <span className="connected-badge">
              <span className="badge-dot" />
              {selectedName}
            </span>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="error-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!levelId && !loading && (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          <h2>Select a ground level to get started</h2>
          <p>Choose a parking level from the dropdown above to load analytics</p>
        </div>
      )}

      {/* Stats cards */}
      {levelId && !loading && (
        <>
          <div className="stats-grid">
            <div className="stat-card stat-purple">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <p className="stat-label">Avg Occupancy</p>
              <p className="stat-value">{avgOccupancy}<span className="stat-unit">%</span></p>
            </div>
            <div className="stat-card stat-red">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <p className="stat-label">Peak Hour</p>
              <p className="stat-value">
                {peakHour ? HOUR_LABELS[peakHour.hourOfDay] : '—'}
              </p>
              {peakHour && <p className="stat-detail">{peakHour.averageRate.toFixed(1)}% avg</p>}
            </div>
            <div className="stat-card stat-green">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <p className="stat-label">Quietest Hour</p>
              <p className="stat-value">
                {quietHour ? HOUR_LABELS[quietHour.hourOfDay] : '—'}
              </p>
              {quietHour && <p className="stat-detail">{quietHour.averageRate.toFixed(1)}% avg</p>}
            </div>
            <div className="stat-card stat-cyan">
              <div className="stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </div>
              <p className="stat-label">Total Transitions</p>
              <p className="stat-value">{totalTransitions.toLocaleString()}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            <div className="chart-full">
              <HourlyOccupancyChart data={hourlyData} />
            </div>
            <div className="chart-full">
              <OccupancyHeatmap data={heatmapData} />
            </div>
            <div className="chart-full">
              <TimelineChart data={timelineData} onDateChange={handleDateChange} />
            </div>
            <div className="chart-full">
              <SlotTransitionsChart data={transitionData} />
            </div>
            <div className="chart-full">
              <SpatialHeatmap levelId={levelId} mapImageUrl={selectedImageUrl} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
