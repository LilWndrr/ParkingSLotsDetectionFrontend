import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_PUBLIC_API_URL || '').trim();
const API_BASE = `${API_URL}/api/v1/groundLevel`;

const MODES = { CAMERA: 'camera', MAP: 'map' };
const CLOSE_THRESHOLD = 14;

export default function AdminSlotEditor() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const mapUploadInputRef = useRef(null);
  const renameInputRef = useRef(null);

  // ── State ──
  const [mode, setMode] = useState(MODES.CAMERA);
  const [parkingName, setParkingName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [bgImage, setBgImage] = useState(null);
  const [imageDims, setImageDims] = useState({ w: 0, h: 0 });
  const [slots, setSlots] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [rectStart, setRectStart] = useState(null);
  const [rectEnd, setRectEnd] = useState(null);
  const [previewJson, setPreviewJson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editName, setEditName] = useState('');
  const [hoveredSlotId, setHoveredSlotId] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [undoHistory, setUndoHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [uploadedMapUrl, setUploadedMapUrl] = useState(null);
  const slotIdCounter = useRef(0);

  // ── Canvas dimensions ──
  const getCanvasDims = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { cw: 0, ch: 0, scale: 1 };
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = imageDims.w ? imageDims.w / cw : 1;
    return { cw, ch, scale };
  }, [imageDims]);

  // ── Draw everything on canvas ──
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { cw, ch } = getCanvasDims();

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cw, ch);

    // Image
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, cw, ch);
    }

    // Draw finished slots
    slots.forEach(slot => {
      const isSelected = slot.id === selectedSlotId;
      const isHovered = slot.id === hoveredSlotId;
      const pts = slot.points;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();

      ctx.fillStyle = isSelected ? 'rgba(96,165,250,0.35)' : isHovered ? 'rgba(52,211,153,0.4)' : 'rgba(52,211,153,0.25)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#60a5fa' : isHovered ? '#6ee7b7' : '#34d399';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Label
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      ctx.font = '700 13px Inter, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slot.name, cx, cy);
    });

    // Draw current polygon points (camera mode)
    if (drawing && mode === MODES.CAMERA && currentPoints.length > 0) {
      const pts = currentPoints;

      // Lines between points
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dashed preview line back to first point
      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.lineTo(pts[0].x, pts[0].y);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Dots
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#60a5fa' : '#34d399';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // Draw rectangle preview (map mode)
    if (drawing && mode === MODES.MAP && rectStart && rectEnd) {
      const x = Math.min(rectStart.x, rectEnd.x);
      const y = Math.min(rectStart.y, rectEnd.y);
      const w = Math.abs(rectEnd.x - rectStart.x);
      const h = Math.abs(rectEnd.y - rectStart.y);
      ctx.fillStyle = 'rgba(52,211,153,0.25)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  }, [bgImage, slots, currentPoints, drawing, mode, rectStart, rectEnd, hoveredSlotId, selectedSlotId, getCanvasDims]);

  // Redraw on state change
  useEffect(() => { redraw(); }, [redraw]);

  // ── Get mouse position relative to canvas ──
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  // ── Upload image ──
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setImageDims({ w: img.width, h: img.height });
        setSlots([]);
        setDrawing(false);
        setCurrentPoints([]);
        setMessage(null);

        // Size the canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const wrapEl = canvas.parentElement;
        const maxW = wrapEl ? wrapEl.clientWidth : 900;
        const scale = maxW / img.width;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ── Start drawing ──
  const startDrawing = () => {
    setDrawing(true);
    setCurrentPoints([]);
    setRectStart(null);
    setRectEnd(null);
    setMessage({ type: 'info', text: mode === MODES.CAMERA
      ? 'Click to place points. Click the first point (blue) to close.'
      : 'Click and drag to draw a rectangle.' });
  };

  // ── Finish polygon ──
  const finishPolygon = useCallback((pts) => {
    const id = ++slotIdCounter.current;
    const name = `Slot-${id}`;
    const newSlot = { id, name, points: [...pts] };
    setSlots(prev => {
      setUndoHistory(h => [...h, prev]);
      return [...prev, newSlot];
    });
    setDrawing(false);
    setCurrentPoints([]);
    setRectStart(null);
    setRectEnd(null);
    setSelectedSlotId(id);
    setMessage({ type: 'success', text: 'Slot drawn! Double-click to rename.' });
    setEditingSlotId(id);
    setEditName(name);
  }, []);

  // ── Undo (Ctrl+Z) ──
  const handleUndo = useCallback(() => {
    if (drawing && currentPoints.length > 0) {
      setCurrentPoints(prev => prev.slice(0, -1));
      return;
    }
    setUndoHistory(prev => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setSlots(last);
      setSelectedSlotId(null);
      return prev.slice(0, -1);
    });
  }, [drawing, currentPoints]);

  // ── Keyboard handler (Ctrl+Z, Delete) ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === 'Delete' && selectedSlotId && !drawing) {
        setUndoHistory(h => [...h, slots]);
        setSlots(prev => prev.filter(s => s.id !== selectedSlotId));
        setSelectedSlotId(null);
        if (editingSlotId === selectedSlotId) setEditingSlotId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, selectedSlotId, drawing, slots, editingSlotId]);

  // ── Zoom ──
  const zoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const zoomReset = () => setZoom(1);

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(z => Math.min(Math.max(z + (e.deltaY < 0 ? 0.1 : -0.1), 0.25), 4));
    }
  };

  // ── Canvas mouse handlers ──
  const handleCanvasMouseDown = (e) => {
    const pos = getMousePos(e);

    // If not drawing, single click selects a slot
    if (!drawing) {
      let found = null;
      for (let i = slots.length - 1; i >= 0; i--) {
        if (isPointInPolygon(pos, slots[i].points)) {
          found = slots[i];
          break;
        }
      }
      setSelectedSlotId(found ? found.id : null);
      return;
    }

    // Drawing — camera mode
    if (mode === MODES.CAMERA) {
      if (currentPoints.length >= 3) {
        const first = currentPoints[0];
        const dist = Math.sqrt((pos.x - first.x) ** 2 + (pos.y - first.y) ** 2);
        if (dist < CLOSE_THRESHOLD) {
          finishPolygon(currentPoints);
          return;
        }
      }
      setCurrentPoints(prev => [...prev, pos]);
      return;
    }

    // Drawing — map mode
    if (mode === MODES.MAP) {
      setRectStart(pos);
      setRectEnd(pos);
    }
  };

  // ── Double-click to rename ──
  const handleCanvasDblClick = (e) => {
    if (drawing) return;
    const pos = getMousePos(e);
    for (let i = slots.length - 1; i >= 0; i--) {
      if (isPointInPolygon(pos, slots[i].points)) {
        setEditingSlotId(slots[i].id);
        setEditName(slots[i].name);
        setSelectedSlotId(slots[i].id);
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const pos = getMousePos(e);

    // Hover detection for slots
    if (!drawing) {
      let found = null;
      for (let i = slots.length - 1; i >= 0; i--) {
        if (isPointInPolygon(pos, slots[i].points)) {
          found = slots[i].id;
          break;
        }
      }
      if (found !== hoveredSlotId) setHoveredSlotId(found);
      canvasRef.current.style.cursor = found ? 'pointer' : 'default';
    }

    // Rectangle drag
    if (drawing && mode === MODES.MAP && rectStart) {
      setRectEnd(pos);
    }
  };

  const handleCanvasMouseUp = () => {
    if (drawing && mode === MODES.MAP && rectStart && rectEnd) {
      const x = Math.min(rectStart.x, rectEnd.x);
      const y = Math.min(rectStart.y, rectEnd.y);
      const w = Math.abs(rectEnd.x - rectStart.x);
      const h = Math.abs(rectEnd.y - rectStart.y);
      if (w > 5 && h > 5) {
        const pts = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ];
        finishPolygon(pts);
      } else {
        setRectStart(null);
        setRectEnd(null);
      }
    }
  };

  // ── Point-in-polygon test (ray casting) ──
  const isPointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if ((yi > point.y) !== (yj > point.y) &&
          point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };

  // ── Auto-focus rename input on double-click ──
  useEffect(() => {
    if (editingSlotId && renameInputRef.current) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [editingSlotId]);

  // ── Rename slot ──
  const confirmRename = () => {
    if (!editName.trim()) return;
    const name = editName.trim();
    if (slots.some(s => s.name === name && s.id !== editingSlotId)) {
      setMessage({ type: 'error', text: `"${name}" already exists` });
      return;
    }
    setSlots(prev => prev.map(s => s.id === editingSlotId ? { ...s, name } : s));
    setEditingSlotId(null);
    setEditName('');
    setMessage(null);
  };

  // ── Delete / Clear ──
  const deleteSlot = (id) => {
    setUndoHistory(h => [...h, slots]);
    setSlots(prev => prev.filter(s => s.id !== id));
    if (editingSlotId === id) setEditingSlotId(null);
    if (selectedSlotId === id) setSelectedSlotId(null);
  };

  const clearAll = () => {
    setSlots([]);
    setDrawing(false);
    setCurrentPoints([]);
    setRectStart(null);
    setRectEnd(null);
    setEditingSlotId(null);
    setMessage(null);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setCurrentPoints([]);
    setRectStart(null);
    setRectEnd(null);
    setMessage(null);
  };

  // ── JSON generation ──
  const generateJson = () => {
    const { scale } = getCanvasDims();
    return slots.map(slot => ({
      parking_name: parkingName,
      level_id: levelId,
      camera_id: mode === MODES.CAMERA ? cameraId : 'UNKNOWN_CAMERA',
      name: slot.name,
      original_width: imageDims.w,
      original_height: imageDims.h,
      isEmpty: true,
      points: slot.points.map(p => [
        Math.round(p.x * scale * 100) / 100,
        Math.round(p.y * scale * 100) / 100,
      ]),
    }));
  };

  const handlePreview = () => {
    if (!slots.length) { setMessage({ type: 'error', text: 'No slots' }); return; }
    setPreviewJson(JSON.stringify(generateJson(), null, 2));
  };

  const handleSave = async () => {
    if (!parkingName || !levelId) { setMessage({ type: 'error', text: 'Fill parking name and level' }); return; }
    if (mode === MODES.CAMERA && !cameraId) { setMessage({ type: 'error', text: 'Fill camera ID' }); return; }
    if (!slots.length) { setMessage({ type: 'error', text: 'Draw at least one slot' }); return; }
    setSaving(true); setMessage(null);
    try {
      await axios.post(mode === MODES.CAMERA ? `${API_URL}/save` : `${API_URL}/saveMap`, generateJson(), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setMessage({ type: 'success', text: `${slots.length} slot(s) saved!` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed: ' + (err.response?.data || err.message) });
    } finally { setSaving(false); }
  };

  // ── Upload floor map to server ──
  const handleMapUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!levelId.trim()) {
      setMessage({ type: 'error', text: 'Enter a Level ID before uploading a floor map.' });
      e.target.value = '';
      return;
    }
    setUploadingMap(true);
    setMessage({ type: 'info', text: 'Uploading floor map…' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(
        `${API_BASE}/${encodeURIComponent(levelId.trim())}/upload-map`,
        formData,
        { 
          headers: { 
            'Content-Type': 'multipart/form-data',
            'ngrok-skip-browser-warning': 'true' 
          } 
        }
      );
      const cdnUrl = res.data?.url || res.data;
      setUploadedMapUrl(cdnUrl);
      setMessage({ type: 'success', text: 'Floor map uploaded successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Map upload failed: ' + (err.response?.data || err.message) });
    } finally {
      setUploadingMap(false);
      e.target.value = '';
    }
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="header-left">
          <div>
            <h1 className="header-title">Slot Configuration</h1>
            <p className="header-subtitle">Draw parking slots on reference images</p>
          </div>
        </div>
        <button className="back-to-map-btn" onClick={() => navigate('/livemap')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </header>

      {/* Mode Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${mode === MODES.CAMERA ? 'active' : ''}`}
          onClick={() => { setMode(MODES.CAMERA); clearAll(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Camera Coordinates
        </button>
        <button className={`admin-tab ${mode === MODES.MAP ? 'active' : ''}`}
          onClick={() => { setMode(MODES.MAP); clearAll(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          Map Coordinates
        </button>
      </div>

      {/* Config */}
      <div className="admin-config">
        <div className="admin-field">
          <label>Parking Name</label>
          <input type="text" value={parkingName} onChange={e => setParkingName(e.target.value)} placeholder="e.g. Çok Katlı Otopark" />
        </div>
        <div className="admin-field">
          <label>Level ID</label>
          <input type="text" value={levelId} onChange={e => setLevelId(e.target.value)} placeholder="e.g. 2" />
        </div>
        {mode === MODES.CAMERA && (
          <div className="admin-field">
            <label>Camera ID</label>
            <input type="text" value={cameraId} onChange={e => setCameraId(e.target.value)} placeholder="e.g. CamNo3" />
          </div>
        )}
        <div className="admin-field">
          <label>Reference Image</label>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="admin-file-input" />
          <button className="admin-upload-btn" onClick={() => fileInputRef.current?.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload Image
          </button>
        </div>
        {mode === MODES.MAP && (
          <div className="admin-field">
            <label>Floor Map (CDN)</label>
            <input type="file" ref={mapUploadInputRef} accept="image/*" onChange={handleMapUpload} className="admin-file-input" />
            <div className="admin-map-upload-group">
              <button
                className={`admin-upload-btn admin-upload-btn-cloud ${uploadingMap ? 'uploading' : ''}`}
                onClick={() => mapUploadInputRef.current?.click()}
                disabled={uploadingMap || !levelId.trim()}
              >
                {uploadingMap ? (
                  <>
                    <span className="admin-upload-spinner" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                      <polyline points="12 13 12 19"/><polyline points="9 16 12 13 15 16"/>
                    </svg>
                    Upload Floor Map
                  </>
                )}
              </button>
              {uploadedMapUrl && (
                <span className="admin-cdn-badge" title={uploadedMapUrl}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Uploaded
                </span>
              )}
            </div>
            {!levelId.trim() && <span className="admin-field-hint">Enter Level ID first</span>}
          </div>
        )}
      </div>

      {/* Message */}
      {message && <div className={`admin-msg admin-msg-${message.type}`}>{message.text}</div>}

      {/* Sticky Toolbar — ABOVE canvas */}
      {bgImage && (
        <div className="admin-toolbar">
          <div className="admin-toolbar-left">
            {editingSlotId ? (
              <div className="admin-rename-inline">
                <span className="admin-rename-label">Rename:</span>
                <input
                  ref={renameInputRef}
                  type="text"
                  className="admin-rename-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmRename();
                    if (e.key === 'Escape') setEditingSlotId(null);
                  }}
                  autoFocus
                />
                <button className="admin-btn admin-btn-primary" onClick={confirmRename}>✓ Save</button>
                <button className="admin-btn" onClick={() => setEditingSlotId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                {!drawing ? (
                  <button className="admin-btn admin-btn-primary" onClick={startDrawing}>
                    + Draw {mode === MODES.CAMERA ? 'Polygon' : 'Rectangle'}
                  </button>
                ) : (
                  <>
                    <span className="admin-drawing-label">
                      ● Drawing{mode === MODES.CAMERA ? ` (${currentPoints.length} pts)` : ''}
                    </span>
                    <button className="admin-btn admin-btn-danger" onClick={cancelDrawing}>Cancel</button>
                  </>
                )}
                <button className="admin-btn" onClick={handleUndo} disabled={!undoHistory.length && !currentPoints.length} title="Ctrl+Z">↩ Undo</button>
                {selectedSlotId && !drawing && (
                  <span className="admin-selected-label">Selected: <strong>{slots.find(s => s.id === selectedSlotId)?.name}</strong> <span className="admin-hint">(DELETE to remove)</span></span>
                )}
              </>
            )}
          </div>
          <div className="admin-toolbar-right">
            <div className="admin-zoom-group">
              <button className="admin-btn admin-btn-sm" onClick={zoomOut} title="Zoom Out">−</button>
              <span className="admin-zoom-label" onClick={zoomReset}>{Math.round(zoom * 100)}%</span>
              <button className="admin-btn admin-btn-sm" onClick={zoomIn} title="Zoom In">+</button>
            </div>
            <button className="admin-btn" onClick={clearAll} disabled={!slots.length}>Clear All</button>
            <button className="admin-btn" onClick={handlePreview} disabled={!slots.length}>Preview JSON</button>
            <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={!slots.length || saving}>
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>
      )}

      {/* Main area with canvas + sidebar */}
      <div className="admin-body">
        {/* Canvas */}
        <div className="admin-canvas-wrap" onWheel={handleWheel}>
          {!bgImage && (
            <div className="admin-canvas-placeholder">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.25">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <p>Upload a reference image to start drawing</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            id="slot-canvas"
            style={{
              display: bgImage ? 'block' : 'none',
              maxWidth: '100%',
              cursor: drawing ? 'crosshair' : 'default',
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onDoubleClick={handleCanvasDblClick}
          />

          {/* Sidebar toggle button */}
          {bgImage && (
            <button className={`admin-sidebar-toggle ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(o => !o)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
              {sidebarOpen ? '' : `Slots (${slots.length})`}
            </button>
          )}
        </div>

        {/* Right Sidebar */}
        <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="admin-sidebar-header">
            <h3>Slots ({slots.length})</h3>
            <button className="admin-sidebar-close" onClick={() => setSidebarOpen(false)}>×</button>
          </div>
          <div className="admin-sidebar-body">
            {slots.length === 0 ? (
              <p className="admin-sidebar-empty">No slots drawn yet</p>
            ) : (
              slots.map(s => (
                <div
                  key={s.id}
                  className={`admin-sidebar-slot ${selectedSlotId === s.id ? 'selected' : ''} ${editingSlotId === s.id ? 'editing' : ''}`}
                  onClick={() => { setSelectedSlotId(s.id); }}
                  onDoubleClick={() => { setEditingSlotId(s.id); setEditName(s.name); }}
                >
                  <div className="admin-sidebar-slot-info">
                    <span className="admin-sidebar-slot-name">{s.name}</span>
                    <span className="admin-sidebar-slot-pts">{s.points.length} points</span>
                  </div>
                  <button className="admin-slot-del" onClick={e => { e.stopPropagation(); deleteSlot(s.id); }}>×</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewJson && (
        <div className="admin-modal-overlay" onClick={() => setPreviewJson(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>JSON Preview — {mode === MODES.CAMERA ? '/save' : '/saveMap'}</h3>
              <button className="admin-modal-close" onClick={() => setPreviewJson(null)}>×</button>
            </div>
            <pre className="admin-modal-code">{previewJson}</pre>
            <button className="admin-btn admin-btn-primary" onClick={() => {
              navigator.clipboard.writeText(previewJson);
              setMessage({ type: 'success', text: 'Copied!' });
              setPreviewJson(null);
            }}>Copy to Clipboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
