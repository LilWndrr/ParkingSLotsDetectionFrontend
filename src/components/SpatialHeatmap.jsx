import { useEffect, useRef, useState, useCallback } from 'react';

const FALLBACK_MAP = '/parking-map.jpg';

function getHeatColor(intensity) {
  if (intensity <= 0) return 'rgba(30,120,255,0.18)';
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    return `rgba(${Math.round(30 + t * 4)},${Math.round(120 + t * 77)},${Math.round(255 - t * 161)},${(0.3 + t * 0.15).toFixed(2)})`;
  }
  if (intensity < 0.5) {
    const t = (intensity - 0.25) / 0.25;
    return `rgba(${Math.round(34 + t * 216)},${Math.round(197 + t * 7)},${Math.round(94 - t * 73)},0.5)`;
  }
  if (intensity < 0.75) {
    const t = (intensity - 0.5) / 0.25;
    return `rgba(${Math.round(250 - t)},${Math.round(204 - t * 89)},${Math.round(21 + t)},${(0.55 + t * 0.05).toFixed(2)})`;
  }
  const t = (intensity - 0.75) / 0.25;
  return `rgba(${Math.round(249 - t * 10)},${Math.round(115 - t * 47)},${Math.round(22 + t * 46)},${(0.6 + t * 0.2).toFixed(2)})`;
}

function redraw(canvas, slots, naturalW, naturalH) {
  if (!canvas || !slots.length || !naturalW || !naturalH) return;

  const displayW = canvas.offsetWidth;
  const displayH = canvas.offsetHeight;
  if (!displayW || !displayH) return;

  // Set canvas resolution to match its CSS display size
  canvas.width = displayW;
  canvas.height = displayH;

  const scaleX = displayW / naturalW;
  const scaleY = displayH / naturalH;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, displayW, displayH);

  slots.forEach(slot => {
    if (!slot.mapPoints || slot.mapPoints.length < 3) return;

    const color = getHeatColor(slot.heatIntensity);
    ctx.beginPath();
    slot.mapPoints.forEach(([x, y], i) => {
      const sx = x * scaleX;
      const sy = y * scaleY;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.9)');
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Centroid label
    const cx = slot.mapPoints.reduce((s, [x]) => s + x, 0) / slot.mapPoints.length * scaleX;
    const cy = slot.mapPoints.reduce((s, [, y]) => s + y, 0) / slot.mapPoints.length * scaleY;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `bold ${Math.max(8, Math.round(11 * Math.min(scaleX, scaleY)))}px Inter,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.name, cx, cy);
  });
}

export default function SpatialHeatmap({ levelId, mapImageUrl }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });

  // Use the Cloudinary CDN URL directly; fall back only if missing
  const effectiveUrl = mapImageUrl || FALLBACK_MAP;

  // Fetch heatmap data
  useEffect(() => {
    if (!levelId) return;
    setLoading(true);
    setSlots([]);
    const API_URL = (import.meta.env.VITE_PUBLIC_API_URL || '').trim();
    fetch(`${API_URL}/api/v1/groundLevel/heatmap?level_id=${levelId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [levelId]);

  // Trigger redraw
  const triggerRedraw = useCallback(() => {
    redraw(canvasRef.current, slots, naturalSize.w, naturalSize.h);
  }, [slots, naturalSize]);

  useEffect(() => {
    triggerRedraw();
  }, [triggerRedraw]);

  // Image loaded — record natural dimensions and trigger redraw
  const handleImageLoad = useCallback((e) => {
    setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
  }, []);

  // ResizeObserver: redraw when the container is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      redraw(canvas, slots, naturalSize.w, naturalSize.h);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [slots, naturalSize]);

  // Mouse move — hit test using canvas pixel coords
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !slots.length || !naturalSize.w) return;

    const rect = canvas.getBoundingClientRect();
    // Canvas pixel coords (canvas.width === canvas.offsetWidth after redraw)
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const scaleX = canvas.width / naturalSize.w;
    const scaleY = canvas.height / naturalSize.h;

    const ctx = canvas.getContext('2d');
    let found = null;
    for (const slot of slots) {
      if (!slot.mapPoints || slot.mapPoints.length < 3) continue;
      ctx.beginPath();
      slot.mapPoints.forEach(([x, y], i) => {
        i === 0 ? ctx.moveTo(x * scaleX, y * scaleY) : ctx.lineTo(x * scaleX, y * scaleY);
      });
      ctx.closePath();
      if (ctx.isPointInPath(mx, my)) { found = slot; break; }
    }

    setHoveredSlot(found);
    setTooltip({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 48 });
  }, [slots, naturalSize]);

  const handleMouseLeave = () => setHoveredSlot(null);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Spatial Occupancy Heatmap</h3>
      <p className="chart-subtitle">Slot activity intensity overlaid on parking map — hover for details</p>

      {loading && (
        <div className="chart-empty" style={{ gap: 12 }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          Loading heatmap data...
        </div>
      )}

      {!loading && (
        <div className="heatmap-map-wrapper">
          <img
            ref={imgRef}
            src={effectiveUrl}
            alt="Parking map"
            className="heatmap-map-img"
            onLoad={handleImageLoad}
            draggable={false}
          />

          <canvas
            ref={canvasRef}
            className="heatmap-map-canvas"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />

          {hoveredSlot && (
            <div className="heatmap-map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              <p className="tooltip-label">{hoveredSlot.name}</p>
              <p className="tooltip-value">{(hoveredSlot.heatIntensity * 100).toFixed(1)}% activity</p>
              <p className="tooltip-detail">{Number(hoveredSlot.totalTransitions).toLocaleString()} transitions</p>
            </div>
          )}

          {slots.length > 0 && (
            <div className="heatmap-map-legend">
              <span className="heatmap-legend-label">Low</span>
              <div className="heatmap-map-legend-bar" />
              <span className="heatmap-legend-label">High</span>
            </div>
          )}

          {!levelId && (
            <div className="heatmap-map-empty">Select a ground level to view the heatmap</div>
          )}
        </div>
      )}
    </div>
  );
}
