import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchParkings } from '../api/livemap';

// Fix default Leaflet marker icons (bundler breaks the default paths)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Create color-coded marker based on occupancy rate
function createParkingIcon(occupancyRate) {
  let color, shadow;
  if (occupancyRate >= 70) {
    color = '#f87171'; shadow = 'rgba(248,113,113,0.4)'; // red
  } else if (occupancyRate >= 40) {
    color = '#fbbf24'; shadow = 'rgba(251,191,36,0.4)'; // orange/yellow
  } else {
    color = '#34d399'; shadow = 'rgba(52,211,153,0.4)'; // green
  }

  return new L.DivIcon({
    className: 'parking-marker',
    html: `<div class="parking-marker-inner" style="background:${color};box-shadow:0 4px 16px ${shadow}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
      </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -42],
  });
}

// Component to auto-fit map bounds to markers
function FitBounds({ parkings }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (parkings.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(
        parkings
          .filter(p => p.latitude && p.longitude)
          .map(p => [p.latitude, p.longitude])
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        fitted.current = true;
      }
    }
  }, [parkings, map]);

  return null;
}

function getOccupancyColor(rate) {
  if (rate >= 70) return '#f87171';
  if (rate >= 40) return '#fbbf24';
  return '#34d399';
}

function getOccupancyLabel(rate) {
  if (rate >= 70) return 'High';
  if (rate >= 40) return 'Moderate';
  return 'Low';
}

export default function ParkingMap() {
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchParkings()
      .then(data => setParkings(data || []))
      .catch(() => setParkings([]))
      .finally(() => setLoading(false));
  }, []);

  // Default center: Istanbul
  const defaultCenter = [41.015, 29.010];

  return (
    <div className="parking-map-page">
      {/* Header */}
      <header className="pmap-header">
        <div className="header-left">
          <div>
            <h1 className="header-title">Smart Parking</h1>
            <p className="header-subtitle">Find available parking near you</p>
          </div>
        </div>
        <div className="header-right">
          <button className="back-to-map-btn" onClick={() => navigate('/livemap')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <div className="pmap-badge">
            <span className="pmap-badge-dot" />
            {loading ? 'Loading...' : `${parkings.length} parking${parkings.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="pmap-container">
        {loading && (
          <div className="pmap-loading">
            <span className="loader-ring" />
          </div>
        )}
        <MapContainer
          center={defaultCenter}
          zoom={12}
          className="pmap-leaflet"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          <FitBounds parkings={parkings} />

          {parkings
            .filter(p => p.latitude && p.longitude)
            .map(p => (
              <Marker
                key={p.id}
                position={[p.latitude, p.longitude]}
                icon={createParkingIcon(p.occupancyRate || 0)}
              >
                <Popup className="pmap-popup">
                  <div className="pmap-popup-content">
                    <h3 className="pmap-popup-title">{p.name}</h3>
                    <div className="pmap-popup-stats">
                      <span className="pmap-popup-avail" style={{ color: getOccupancyColor(p.occupancyRate || 0) }}>
                        {p.availableSlots ?? '—'} available
                      </span>
                      <span className="pmap-popup-total">
                        of {p.totalSlots ?? '—'} total
                      </span>
                    </div>
                    <button
                      className="pmap-popup-btn"
                      onClick={() => navigate(`/livemap?parking=${p.id}`)}
                    >
                      View Live Map →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
}
