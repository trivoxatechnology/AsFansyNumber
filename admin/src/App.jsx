import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import { validateSession } from './utils/authService';
import ErrorBoundary from './utils/ErrorBoundary';

// Layout & Infrastructure
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';

// Actual Pages
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import UploadManager from './pages/UploadManager';
import DraftManager from './pages/DraftManager';
import DraftManagement from './pages/DraftManagement';
import LogHistory from './pages/LogHistory';
import { ImportProvider } from './context/ImportContext';
import { OperatorProvider } from './components/OperatorPrompt';

// Placeholder Pages (To be built next)
const UploadCenter = () => <div className="card"><h2>Upload Center</h2><p>Coming soon...</p></div>;
const UploadLogs = () => <div className="card"><h2>Upload Logs</h2><p>Coming soon...</p></div>;
const SoldNumbers = () => <div className="card"><h2>Sold Numbers</h2><p>Coming soon...</p></div>;
const Dealers = () => <div className="card"><h2>Dealers</h2><p>Coming soon...</p></div>;
const WhatsAppConfig = () => <div className="card"><h2>WhatsApp Config</h2><p>Coming soon...</p></div>;
const ActivityLog = () => <div className="card"><h2>Activity Log</h2><p>Coming soon...</p></div>;

// Legacy components to be removed once rebuild is complete
import OfferUpload from './pages/OfferUpload';
import ImportWorkspace from './pages/ImportWorkspace';
import DeleteExcel from './pages/DeleteExcel';

// Protected Route Wrapper
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
        <OperatorProvider>
          <DashboardLayout />
        </OperatorProvider>
      </ImportProvider>
    </ProtectedRoute>
  );
};

// Toast slide-in animation
const toastCSS = `@keyframes toastSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`;

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <style>{toastCSS}</style>
          <BrowserRouter basename="/admin">
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={<DashboardWrapper />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="inventory" element={<Inventory />} />
                
                {/* Refactored Pages */}
                <Route path="upload" element={<UploadManager />} />
                <Route path="drafts" element={<DraftManager />} />
                <Route path="logs" element={<LogHistory />} />
                
                {/* Future Pages */}
                <Route path="sold" element={<SoldNumbers />} />
                <Route path="dealers" element={<Dealers />} />
                <Route path="whatsapp" element={<WhatsAppConfig />} />
                <Route path="activity" element={<ActivityLog />} />

                {/* Legacy fallback / migration paths */}
                <Route path="import-workspace" element={<Navigate to="/upload" replace />} />
                <Route path="offer-upload" element={<OfferUpload />} />
                <Route path="delete-excel" element={<DeleteExcel />} />
                <Route path="draft-management" element={<Navigate to="/drafts" replace />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
