import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ImportWorkspace from './pages/ImportWorkspace';
import OfferUpload from './pages/OfferUpload';
import Inventory from './pages/Inventory';
import Discounts from './pages/Discounts';
import DeleteExcel from './pages/DeleteExcel';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="import-workspace" element={<ImportWorkspace />} />
          <Route path="offer-upload" element={<OfferUpload />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="discounts" element={<Discounts />} />
          <Route path="delete-excel" element={<DeleteExcel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
