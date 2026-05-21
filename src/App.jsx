import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import ParkingMap from './pages/ParkingMap';
import AdminSlotEditor from './pages/AdminSlotEditor';

/** Layout for pages that need the Navbar (Analytics, Admin) */
function DashboardLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function App() {
  return (
    <Routes>
      {/* Standalone pages — no Navbar */}
      <Route path="/" element={<Navigate to="/livemap" replace />} />
      <Route path="/livemap" element={<LiveMap />} />
      <Route path="/livemap/parkings" element={<ParkingMap />} />

      {/* Pages with Navbar */}
      <Route element={<DashboardLayout />}>
        <Route path="/analytics" element={<Dashboard />} />
        <Route path="/admin/slots" element={<AdminSlotEditor />} />
      </Route>
    </Routes>
  );
}

export default App;
