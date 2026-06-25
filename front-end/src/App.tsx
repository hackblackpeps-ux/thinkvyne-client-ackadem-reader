import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AdminPortalPage } from './routes/AdminPortalPage';
import { ClientLibraryPage } from './routes/ClientLibraryPage';
import { ClientReaderPage } from './routes/ClientReaderPage';
import { LandingPage } from './routes/LandingPage';
import { BrowserNotificationWrapper } from './components/shared/BrowserNotificationWrapper';

function getDomainType() {
  const host = window.location.hostname;
  // Allow all routes in local development or if specifically set to development environment
  if (host === 'localhost' || host === '127.0.0.1' || import.meta.env.VITE_ENVIRONMENT === 'development') return 'all';
  // Check if it's the admin dashboard
  if (host.startsWith('dashboard.')) return 'admin';
  // Otherwise, assume it's the main client website
  return 'client';
}

function App() {
  const domainType = getDomainType();

  return (
    <Router>
      <BrowserNotificationWrapper />
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Client Routes - Only available on ackadem.com or localhost */}
        {(domainType === 'client' || domainType === 'all') && (
          <>
            <Route path="/library" element={<ClientLibraryPage />} />
            <Route path="/reader/:id" element={<ClientReaderPage />} />
          </>
        )}

        {/* Admin Routes - Only available on dashboard.ackadem.com or localhost */}
        {(domainType === 'admin' || domainType === 'all') && (
          <Route path="/admin/upload" element={<AdminPortalPage />} />
        )}
        
        {/* Default redirect to Landing Page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
