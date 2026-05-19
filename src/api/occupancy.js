import axios from 'axios';

const API_BASE = (import.meta.env.VITE_PUBLIC_API_URL || '').trim();

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchHourlyOccupancy(groundLevelId) {
  const res = await api.get('/api/v1/occupancy/byHour', {
    params: { ground_level_id: groundLevelId },
  });
  return res.data;
}

export async function fetchOccupancyByDayAndHour(groundLevelId) {
  const res = await api.get('/api/v1/occupancy/byHourAndDayOfWeek', {
    params: { ground_level_id: groundLevelId },
  });
  return res.data;
}

export async function fetchOccupancyByTimeInterval(groundLevelId, from, to) {
  const res = await api.post(
    '/api/v1/occupancy/byTimeInterval',
    { from, to },
    { params: { ground_level_id: groundLevelId } }
  );
  return res.data;
}

export async function fetchSlotTransitions(levelId) {
  const res = await api.get('/api/v1/events/countByHours', {
    params: { level_id: levelId },
  });
  return res.data;
}

export async function fetchGroundLevels() {
  const res = await api.get('/api/v1/groundLevel/all');
  return res.data; // [{id, name, imageUrl}]
}

export async function fetchSpatialHeatmap(levelId) {
  const res = await api.get('/api/v1/groundLevel/heatmap', {
    params: { level_id: levelId },
  });
  return res.data; // [{name, mapPoints, totalTransitions, heatIntensity}]
}
