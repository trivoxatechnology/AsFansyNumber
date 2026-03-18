import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ImportProvider } from './context/ImportContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
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

// Toast slide-in animation
const toastCSS = `@keyframes toastSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ImportProvider>
          <style>{toastCSS}</style>
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
      </ConfirmProvider>
    </ToastProvider>
  );
}

