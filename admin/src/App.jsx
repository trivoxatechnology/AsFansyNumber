import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ImportProvider } from './context/ImportContext';
import { validateSession } from './utils/authService';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ImportWorkspace from './pages/ImportWorkspace';
import OfferUpload from './pages/OfferUpload';
import Inventory from './pages/Inventory';
import DeleteExcel from './pages/DeleteExcel';
import DraftManagement from './pages/DraftManagement';

// Protected Route Wrapper — validates token format AND session expiry
const ProtectedRoute = ({ children }) => {
  if (!validateSession()) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <ImportProvider>
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
          <Route path="delete-excel" element={<DeleteExcel />} />
          <Route path="draft-management" element={<DraftManagement />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </ImportProvider>
  );
}
