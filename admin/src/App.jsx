import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import { validateSession } from './utils/authService';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import Inventory from './pages/Inventory';
import UploadManager from './pages/UploadManager';
import DraftManager from './pages/DraftManager';
import { ImportProvider } from './context/ImportContext';

// Protected Route Wrapper — validates token format AND session expiry
const ProtectedRoute = ({ children }) => {
  if (!validateSession()) return <Navigate to="/login" replace />;
  return children;
};

// Wrapper for Dashboard so ImportProvider only mounts for authenticated users
// and React Router's <Outlet /> works correctly.
const DashboardWrapper = () => {
  return (
    <ProtectedRoute>
      <ImportProvider>
        <DashboardLayout />
      </ImportProvider>
    </ProtectedRoute>
  );
};

// Toast slide-in animation
const toastCSS = `@keyframes toastSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <style>{toastCSS}</style>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Protected Dashboard Routes */}
            <Route path="/" element={<DashboardWrapper />}>
              <Route index element={<Navigate to="/inventory" replace />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="upload" element={<UploadManager />} />
              <Route path="drafts" element={<DraftManager />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}
