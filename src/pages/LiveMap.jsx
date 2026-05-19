import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchParkings, fetchGroundLevelsByParking, fetchMapData } from '../api/livemap';
import useWebSocket from '../hooks/useWebSocket';

export default function LiveMap() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlParkingId = searchParams.get('parking');

  // ── Selector state ──
  const [parkings, setParkings] = useState([]);
  const [levels, setLevels] = useState([]);
  const [selectedParking, setSelectedParking] = useState(null); // {id, name}
  const [selectedLevel, setSelectedLevel] = useState(null);     // {id, name}
  const [loadingParkings, setLoadingParkings] = useState(true);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState(null);

  // ── Map state ──
  const [mapImageUrl, setMapImageUrl] = useState('');
  const [slots, setSlots] = useState([]);         // [{name, isEmpty, mapPoints}]
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Refs ──
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const wrapperRef = useRef(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // Track selected context for WS filtering
  const selectedRef = useRef({ parkingName: null, groundLevelName: null });

  // ── WebSocket ──
  const handleWsMessage = useCallback((msg) => {
    // msg: { parkingName, groundLevelName, slotId, isEmpty }
    const ctx = selectedRef.current;
    if (!ctx.parkingName || !ctx.groundLevelName) return;
    if (msg.parkingName !== ctx.parkingName || msg.groundLevelName !== ctx.groundLevelName) return;

    setSlots(prev => prev.map(s =>
      s.name === msg.slotId ? { ...s, isEmpty: msg.isEmpty } : s
    ));
  }, []);

  const { connected, connect, disconnect } = useWebSocket(handleWsMessage);

  // ── Load parkings on mount + auto-select from URL ──
  useEffect(() => {
    setLoadingParkings(true);
    fetchParkings()
      .then(data => {
        const list = data || [];
        setParkings(list);
        // Auto-select parking from URL param
        if (urlParkingId) {
          const parking = list.find(p => p.id === urlParkingId);
          if (parking) {
            setSelectedParking(parking);
            setLoadingLevels(true);
            fetchGroundLevelsByParking(parking.id)
              .then(levels => setLevels(levels || []))
              .catch(() => setLevels([]))
              .finally(() => setLoadingLevels(false));
          }
        }
      })
      .catch(() => setParkings([]))
      .finally(() => setLoadingParkings(false));
  }, [urlParkingId]);

  // ── Auto-connect WebSocket on mount ──
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // ── Select parking (from grid card) ──
  const selectParking = async (parking) => {
    setSelectedParking(parking);
    setSelectedLevel(null);
    resetMap();
    setLoadingLevels(true);
    try {
      const data = await fetchGroundLevelsByParking(parking.id);
      setLevels(data || []);
    } catch {
      setLevels([]);
    } finally {
      setLoadingLevels(false);
    }
  };

  // ── Deselect parking (go back to grid) ──
  const deselectParking = () => {
    setSelectedParking(null);
    setSelectedLevel(null);
    setLevels([]);
    resetMap();
  };

  // ── Grid helpers ──
  const getGridColor = (rate) => {
    if (rate >= 70) return '#f87171';
    if (rate >= 40) return '#fbbf24';
    return '#34d399';
  };
  const getGridLabel = (rate) => {
    if (rate >= 70) return 'High';
    if (rate >= 40) return 'Moderate';
    return 'Low';
  };

  // ── Handle level change (shared loader) ──
  const loadLevel = async (level) => {
    if (!level || !selectedParking) return;
    setSelectedLevel(level);
    selectedRef.current = {
      parkingName: selectedParking.name,
      groundLevelName: level.name,
    };

    setLoadingMap(true);
    setError(null);
    try {
      const data = await fetchMapData(selectedParking.name, level.name);
      const imgUrl = (data.mapImageUrl || '').replace(/^"|"$/g, '').trim();
      setMapImageUrl(imgUrl);
      const normalizedSlots = (data.slots || []).map(s => ({
        ...s,
        isEmpty: s.isEmpty !== undefined ? s.isEmpty : s.empty,
      }));
      setSlots(normalizedSlots);
      setOccupancyRate(data.occupancyRate || 0);
    } catch (err) {
      setError('Failed to load map data. Check that the backend is running.');
      console.error(err);
      resetMap();
    } finally {
      setLoadingMap(false);
    }
  };

  const handleLevelChange = (e) => {
    const id = e.target.value;
    if (!id || !selectedParking) {
      setSelectedLevel(null);
      resetMap();
      return;
    }
    loadLevel(levels.find(l => l.id === id));
  };

  // ── Floor elevator navigation ──
  const currentLevelIndex = selectedLevel ? levels.findIndex(l => l.id === selectedLevel.id) : -1;
  const canGoUp = currentLevelIndex > 0;
  const canGoDown = currentLevelIndex >= 0 && currentLevelIndex < levels.length - 1;

  const goFloorUp = () => {
    if (canGoUp) loadLevel(levels[currentLevelIndex - 1]);
  };
  const goFloorDown = () => {
    if (canGoDown) loadLevel(levels[currentLevelIndex + 1]);
  };

  const resetMap = () => {
    setMapImageUrl('');
    setSlots([]);
    setOccupancyRate(0);
    setHoveredSlot(null);
    selectedRef.current = { parkingName: null, groundLevelName: null };
  };

  // ── Canvas drawing ──
  const drawSlots = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = img.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return;

    const scaleX = rect.width / naturalW;
    const scaleY = rect.height / naturalH;

    slotsRef.current.forEach(slot => {
      if (!slot.mapPoints || slot.mapPoints.length < 3) return;

      const points = slot.mapPoints.map(p => [p[0] * scaleX, p[1] * scaleY]);

      // Fill
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();

      const isHovered = hoveredSlot === slot.name;
      if (slot.isEmpty) {
        ctx.fillStyle = isHovered ? 'rgba(34, 197, 94, 0.55)' : 'rgba(34, 197, 94, 0.35)';
        ctx.strokeStyle = isHovered ? 'rgba(34, 197, 94, 1)' : 'rgba(34, 197, 94, 0.7)';
      } else {
        ctx.fillStyle = isHovered ? 'rgba(239, 68, 68, 0.55)' : 'rgba(239, 68, 68, 0.35)';
        ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 1)' : 'rgba(239, 68, 68, 0.7)';
      }
      ctx.fill();
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Slot label
      const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
      const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
      ctx.font = `600 ${Math.max(10, 12 * scaleX)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(slot.name, cx, cy);
    });
  }, [hoveredSlot]);

  // Redraw when slots or hover changes
  useEffect(() => {
    drawSlots();
  }, [slots, drawSlots]);

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawSlots();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawSlots]);

  // ── Mouse interaction for hover ──
  const handleCanvasMove = (e) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const scaleX = rect.width / naturalW;
    const scaleY = rect.height / naturalH;

    let found = null;
    for (const slot of slotsRef.current) {
      if (!slot.mapPoints || slot.mapPoints.length < 3) continue;
      const points = slot.mapPoints.map(p => [p[0] * scaleX, p[1] * scaleY]);
      if (isPointInPolygon(mouseX, mouseY, points)) {
        found = slot;
        break;
      }
    }

    if (found) {
      setHoveredSlot(found.name);
      setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 10 });
    } else {
      setHoveredSlot(null);
    }
  };

  const handleCanvasLeave = () => setHoveredSlot(null);

  // ── Occupancy helpers ──
  const totalSlots = slots.length;
  const occupiedSlots = slots.filter(s => !s.isEmpty).length;
  const emptySlots = totalSlots - occupiedSlots;
  const liveRate = totalSlots > 0 ? ((occupiedSlots / totalSlots) * 100) : 0;
  const displayRate = totalSlots > 0 ? liveRate : occupancyRate;

  const getOccupancyColor = (rate) => {
    if (rate < 40) return 'var(--accent-green)';
    if (rate < 70) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  const getOccupancyLabel = (rate) => {
    if (rate < 40) return 'Low';
    if (rate < 70) return 'Moderate';
    return 'High';
  };

  return (
    <div className="livemap">
      {/* Header */}
      <header className="livemap-header">
        <div className="header-left">
          <div>
            <h1 className="header-title">Live Parking Map</h1>
            <p className="header-subtitle">Real-time slot occupancy</p>
          </div>
        </div>
        <div className="header-right">
          <button className="back-to-map-btn" onClick={() => navigate('/livemap/parkings')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Map View
          </button>
          <div className={`ws-badge ${connected ? 'ws-connected' : 'ws-disconnected'}`}>
            <span className="ws-dot" />
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>
      </header>

      {/* Parking Grid — shown when no parking is selected */}
      {!selectedParking && (
        <div className="pmap-grid-section">
          <h2 className="pmap-grid-title">Select a Parking</h2>
          {loadingParkings ? (
            <div className="empty-state" style={{ minHeight: '30vh' }}>
              <div className="map-loader"><span className="loader-ring" /></div>
              <p>Loading parkings...</p>
            </div>
          ) : (
            <div className="pmap-grid">
              {parkings.map(p => {
                const rate = p.occupancyRate || 0;
                const color = getGridColor(rate);
                return (
                  <div key={p.id} className="pmap-card" onClick={() => selectParking(p)}>
                    <div className="pmap-card-header">
                      <div className="pmap-card-icon" style={{ background: `${color}22`, borderColor: `${color}44` }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
                        </svg>
                      </div>
                      <div className="pmap-card-name">{p.name}</div>
                    </div>
                    <div className="pmap-card-stats">
                      <div className="pmap-card-stat">
                        <span className="pmap-card-stat-val" style={{ color }}>{p.availableSlots ?? 0}</span>
                        <span className="pmap-card-stat-lbl">Available</span>
                      </div>
                      <div className="pmap-card-stat">
                        <span className="pmap-card-stat-val stat-occupied">{p.occupiedSlots ?? 0}</span>
                        <span className="pmap-card-stat-lbl">Occupied</span>
                      </div>
                      <div className="pmap-card-stat">
                        <span className="pmap-card-stat-val stat-total">{p.totalSlots ?? 0}</span>
                        <span className="pmap-card-stat-lbl">Total</span>
                      </div>
                    </div>
                    <div className="pmap-card-footer">
                      <div className="pmap-card-bar-track">
                        <div className="pmap-card-bar-fill" style={{ width: `${rate}%`, background: color }} />
                      </div>
                      <span className="pmap-card-rate" style={{ color }}>
                        {rate.toFixed(0)}% · {getGridLabel(rate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Controls — shown when a parking is selected */}
      {selectedParking && (
        <div className="controls-bar">
          <button className="back-to-grid-btn" onClick={deselectParking}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {selectedParking.name}
          </button>

          <div className="select-group">
            <label htmlFor="level-select">Ground Level</label>
            <select
              id="level-select"
              value={selectedLevel?.id || ''}
              onChange={handleLevelChange}
              disabled={!selectedParking || loadingLevels}
            >
              <option value="">
                {loadingLevels ? 'Loading...' : 'Select Level'}
              </option>
              {levels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {selectedLevel && !loadingMap && totalSlots > 0 && (
            <div className="stats-row">
              <div className="mini-stat">
                <span className="mini-stat-value" style={{ color: getOccupancyColor(displayRate) }}>
                  {displayRate.toFixed(1)}%
                </span>
                <span className="mini-stat-label">Occupancy</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-value stat-occupied">{occupiedSlots}</span>
                <span className="mini-stat-label">Occupied</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-value stat-empty">{emptySlots}</span>
                <span className="mini-stat-label">Available</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-value stat-total">{totalSlots}</span>
                <span className="mini-stat-label">Total</span>
              </div>
              <div className="occupancy-tag" style={{
                background: `${getOccupancyColor(displayRate)}22`,
                color: getOccupancyColor(displayRate),
                borderColor: `${getOccupancyColor(displayRate)}44`,
              }}>
                {getOccupancyLabel(displayRate)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {/* Empty state — select a level */}
      {selectedParking && !selectedLevel && !loadingMap && (
        <div className="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
          </svg>
          <h2>Select a ground level</h2>
          <p>Choose a floor from the dropdown above to view the live occupancy map</p>
        </div>
      )}

      {/* Loading */}
      {loadingMap && (
        <div className="empty-state">
          <div className="map-loader">
            <span className="loader-ring" />
          </div>
          <p>Loading map data...</p>
        </div>
      )}

      {/* Map */}
      {selectedLevel && !loadingMap && mapImageUrl && (
        <div className="map-section">
          <div className="map-with-elevator">
            {/* ── Floor Elevator ── */}
            {levels.length > 1 && (
              <div className="floor-elevator">
                <button
                  className="elevator-btn"
                  onClick={goFloorUp}
                  disabled={!canGoUp}
                  title="Go up one floor"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>

                <div className="elevator-indicator" key={selectedLevel?.id}>
                  <span className="elevator-floor-num">{selectedLevel?.name || '—'}</span>
                </div>

                <button
                  className="elevator-btn"
                  onClick={goFloorDown}
                  disabled={!canGoDown}
                  title="Go down one floor"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            )}

            {/* ── Map Container ── */}
            <div className="map-wrapper" ref={wrapperRef}>
              <img
                ref={imgRef}
                className="map-image"
                src={mapImageUrl}
                alt={`${selectedParking?.name} - ${selectedLevel?.name} floor plan`}
                onLoad={drawSlots}
                draggable={false}
              />
              <canvas
                ref={canvasRef}
                className="map-canvas"
                onMouseMove={handleCanvasMove}
                onMouseLeave={handleCanvasLeave}
              />

              {/* Hover tooltip */}
              {hoveredSlot && (
                <div
                  className="slot-tooltip"
                  style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                  <span className="slot-tooltip-name">{hoveredSlot}</span>
                  <span className={`slot-tooltip-status ${slots.find(s => s.name === hoveredSlot)?.isEmpty ? 'status-empty' : 'status-occupied'
                    }`}>
                    {slots.find(s => s.name === hoveredSlot)?.isEmpty ? '● Available' : '● Occupied'}
                  </span>
                </div>
              )}

              {/* Legend — absolute overlay (hidden on mobile via CSS) */}
              <div className="map-legend">
                <div className="legend-item">
                  <span className="legend-swatch legend-green" />
                  Available
                </div>
                <div className="legend-item">
                  <span className="legend-swatch legend-red" />
                  Occupied
                </div>
              </div>
            </div>
          </div>

          {/* Legend — static below map (shown on mobile only via CSS) */}
          <div className="map-legend-static">
            <div className="legend-item">
              <span className="legend-swatch legend-green" />
              Available
            </div>
            <div className="legend-item">
              <span className="legend-swatch legend-red" />
              Occupied
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function isPointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
