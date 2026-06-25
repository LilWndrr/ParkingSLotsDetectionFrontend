# Smart Parking Frontend

A premium, interactive React dashboard and real-time visualization frontend for the **Smart Parking Spot Detection System**. This application provides users with real-time parking availability maps, navigation links, detailed historical analytics, and an administrative interface for drawing and editing slot coordinates.

---

## 🚀 Features

### 1. 📍 Find & Navigate to Parking
- **Leaflet Integration**: High-performance interactive maps using OpenStreetMap tiles to view all available parking lots globally.
- **Navigation Shortcuts**: Color-coded markers based on current occupancy rates (Low, Moderate, High) with direct links to navigate via:
  - Google Maps
  - Waze
  - Apple Maps (System default)
- **Live Info Popups**: Instantly check available spots versus total capacity prior to departure.

### 2. ⚡ Real-Time Live Parking Floor Maps
- **STOMP WebSockets**: Subscribes directly to real-time coordinate updates (`/topic/parking-updates`) to highlight empty (green) and occupied (red) slots dynamically without page reloading.
- **Floor Elevator Navigation**: Seamlessly navigate between different floors/levels of a parking structure with a native indicator.
- **Interactive Canvas Drawing Overlay**: Mouse hover tooltips highlight individual slot names and their live status details.

### 3. 📊 Occupancy Intelligence (Analytics Dashboard)
Built using **Recharts** to deliver actionable insights on parking patterns:
- **Average Occupancy Rate**: At-a-glance KPI monitoring.
- **Peak and Quiet Hours**: Identify peak traffic periods throughout the day.
- **Hourly Occupancy Curve**: Continuous area chart displaying utilization rates.
- **Weekly Heatmap**: Day-of-week vs. Hour-of-day occupancy matrices.
- **Timeline Filtering**: Custom date range selection.
- **Slot Transitions**: Bar charts showing parking entry/exit counts by hour.
- **Spatial Heatmap Overlay**: Canvas-rendered heat signatures mapping busiest slots based on historical transitions.

### 4. 🛠️ Administrative Slot Configuration Editor
A full-featured canvas-based vector tool to configure parking slot layouts:
- **Two Modalities**:
  - **Camera Coordinates**: Draw custom polygons over live CCTV frames.
  - **Map Coordinates**: Draw precise bounding rectangles over architectural floor plans.
- **On-Canvas Interaction**: Click-to-place coordinates, select and delete active boundaries, and use inline renaming widgets.
- **History Management**: Dynamic keyboard bindings supporting `Ctrl+Z` (Undo) and `Delete` (Remove selected slot).
- **CDN Map Upload**: Upload floor plan assets directly to backend cloud storage.
- **JSON Exporter**: Local storage validation and live API payload export preview.

---

## 🛠️ Technology Stack

- **Core**: React (v19), JavaScript (ES Modules)
- **Tooling**: Vite (v8)
- **Routing**: React Router DOM (v7)
- **Network**: Axios
- **Real-Time Subscription**: `@stomp/stompjs` + `sockjs-client`
- **Mapping**: Leaflet + React Leaflet
- **Charts**: Recharts
- **Design & Layout**: Pure Vanilla CSS featuring dark/light palettes, glassmorphism, responsive hamburger navigation, and micro-interactions.

---

## 📂 Directory Structure

```
parking-frontend/
├── dist/                # Production build output
├── public/              # Static assets
└── src/
    ├── api/             # API clients
    │   ├── livemap.js   # Fetching maps, floors, and real-time layout data
    │   └── occupancy.js # Fetching dashboard metrics and heatmaps
    ├── components/      # Shared React components (visualizations/charts)
    │   ├── HourlyOccupancyChart.jsx
    │   ├── Navbar.jsx
    │   ├── OccupancyHeatmap.jsx
    │   ├── SlotTransitionsChart.jsx
    │   ├── SpatialHeatmap.jsx
    │   └── TimelineChart.jsx
    ├── hooks/           # Custom React hooks
    │   └── useWebSocket.js # STOMP client websocket manager
    ├── pages/           # Route views
    │   ├── AdminSlotEditor.jsx  # Canvas-based polygon editor
    │   ├── Dashboard.jsx        # Analytics charts & telemetry metrics
    │   ├── LiveMap.jsx          # Interactive floor layouts
    │   └── ParkingMap.jsx       # Leaflet geocoded map and routing
    ├── App.jsx          # Router & Layout configurations
    ├── index.css        # Curated global styling & theme variables
    └── main.jsx         # React application entry point
```

---

## ⚙️ Setup and Installation

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **npm** installed.

### 2. Installation
Install project dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_PUBLIC_API_URL=http://localhost:8085
```
*Note: If connecting to a remote endpoint (e.g., ngrok tunnels), replace this URL with your custom proxy target.*

### 4. Running the Development Server
Start the local Vite dev server:
```bash
npm run dev
```
By default, the server runs on [http://localhost:3000](http://localhost:3000).

### 5. Build for Production
To compile and optimize the assets for deployment:
```bash
npm run build
```
The output will be generated inside the `/dist` folder.

---

## 📡 API Proxy & CORS Handling

In development mode, requests are automatically proxied via the Vite dev server to prevent CORS issues. You can modify these bindings inside `vite.config.js`:

```javascript
server: {
  port: 3000,
  allowedHosts: ['your-tunnel-domain.ngrok-free.dev'], // ngrok support
  proxy: {
    '/api': { target: 'http://localhost:8085', changeOrigin: true },
    '/save': { target: 'http://localhost:8085', changeOrigin: true },
    '/saveMap': { target: 'http://localhost:8085', changeOrigin: true },
    '/ws': { target: 'http://localhost:8085', ws: true, changeOrigin: true },
  }
}
```

---

## 🎨 Styling Architecture (`merge-css.cjs`)

The global style system inside `src/index.css` is managed using a build-time merger script `merge-css.cjs`. If you need to refresh, recompile, or import modifications from upstream assets, run:
```bash
node merge-css.cjs
```
This utility automatically bundles separate layout scripts and navigation components, applying the app's signature variables (e.g., `--accent-green`, `--bg-secondary`, and custom animation scales).
