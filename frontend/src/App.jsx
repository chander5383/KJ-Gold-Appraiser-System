import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';

// Route-level code splitting: previously all seven pages were pulled into the
// initial bundle, so a user landing on /login downloaded the certificate editor,
// the admin panel and the PDF render target before they could type a password.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CertificatePage = lazy(() => import('./pages/CertificatePage'));
const CertificatePrintPage = lazy(() => import('./pages/CertificatePrintPage'));
const CertificateSimplePage = lazy(() => import('./pages/CertificateSimplePage'));
const CertificateSimplePrintPage = lazy(() => import('./pages/CertificateSimplePrintPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function FullPageSpinner({ label = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin motion-reduce:animate-none"
          role="status"
          aria-label={label}
        />
        <p className="text-slate-500 dark:text-gray-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <FullPageSpinner />;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-gray-950">
      <Sidebar />

      {/*
        min-w-0 is load-bearing. A flex item defaults to min-width:auto, which
        refuses to shrink below its content's min-content width — measured at a
        320px viewport this <main> rendered 826px wide on /certificate, which
        pushed the overflow past every inner overflow-x-auto container and out to
        the document, producing page-level horizontal scrolling on mobile and
        tablet. With min-w-0 the inner scroll containers do their job.

        Left margin tracks the three sidebar tiers: drawer (<md, no margin),
        collapsed icon rail (md–lg, 5rem), permanent (lg+, 16rem).
      */}
      <main className="flex-1 min-w-0 w-full ml-0 md:ml-20 lg:ml-64 min-h-screen">
        {/*
          pt-20 below md clears the fixed drawer toggle button (top-4 left-4,
          h-11), which previously overlapped every page's <h1>.
        */}
        <div className="p-4 pt-20 md:pt-6 lg:p-6 print:p-0 print:m-0 print:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        containerClassName="no-print"
        toastOptions={{
          duration: 3000,
          className: 'max-w-[calc(100vw-2rem)]',
          style: {
            borderRadius: '12px',
            background: '#1e293b',
            color: '#fff',
            fontWeight: '500',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />

      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout><DashboardPage /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/certificate" element={
            <ProtectedRoute>
              <AppLayout><CertificatePage /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/certificate/:id" element={
            <ProtectedRoute>
              <AppLayout><CertificatePage /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Playwright PDF render target — standalone page, no sidebar/controls */}
          <Route path="/certificate/:id/print" element={<CertificatePrintPage />} />

          {/* ===== SIMPLE CERTIFICATE MODULE (no 24ct/22ct) ===== */}
          <Route path="/certificate-simple" element={
            <ProtectedRoute>
              <AppLayout><CertificateSimplePage /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/certificate-simple/:id" element={
            <ProtectedRoute>
              <AppLayout><CertificateSimplePage /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Playwright PDF render target for simple certificate */}
          <Route path="/certificate-simple/:id/print" element={<CertificateSimplePrintPage />} />

          <Route path="/history" element={
            <ProtectedRoute>
              <AppLayout><HistoryPage /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <AppLayout><AdminPage /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout><SettingsPage /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
