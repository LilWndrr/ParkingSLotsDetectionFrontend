import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_PUBLIC_API_URL || '').trim(),
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
});

/**
 * GET /api/maps/getAll
 * Returns: [{id, name}]
 */
export async function fetchParkings() {
  const res = await api.get('/api/maps/getAll');
  return res.data;
}

/**
 * GET /api/v1/groundLevel/byParking?parking_id=X
 * Returns: [{id, name, imageUrl}]
 */
export async function fetchGroundLevelsByParking(parkingId) {
  const res = await api.get('/api/v1/groundLevel/byParking', {
    params: { parking_id: parkingId },
  });
  return res.data;
}

/**
 * GET /api/v1/display/map?parking_name=X&ground_level_id=Y
 * Returns: { mapImageUrl, slots: [{name, isEmpty, mapPoints}], occupancyRate }
 */
export async function fetchMapData(parkingName, groundLevelName) {
  const res = await api.get('/api/v1/display/map', {
    params: { parking_name: parkingName, ground_level_id: groundLevelName },
  });
  return res.data;
}
