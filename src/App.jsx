import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import ParkingMap from './pages/ParkingMap';
import AdminSlotEditor from './pages/AdminSlotEditor';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/livemap" replace />} />
        <Route path="/analytics" element={<Dashboard />} />
        <Route path="/livemap" element={<LiveMap />} />
        <Route path="/livemap/parkings" element={<ParkingMap />} />
        <Route path="/admin/slots" element={<AdminSlotEditor />} />
      </Routes>
    </>
  );
}

export default App;
