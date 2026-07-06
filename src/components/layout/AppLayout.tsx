import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { OraculoFloatingChat } from '@/components/oraculo/OraculoFloatingChat';
import { ErrorBoundary } from './ErrorBoundary';
import { NotificationBell } from './NotificationBell';

const RESTRICTED_FOR_CONSULTOR = ['/', '/contratos', '/consultores', '/configuracoes'];

export function AppLayout() {
  const { user, loading, roleLoading, userRole, forcePasswordChange } = useAuth();
  const location = useLocation();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Force password change on first login
  if (forcePasswordChange) {
    return <Navigate to="/trocar-senha" replace />;
  }

  // Consultors accessing restricted routes get redirected to /projetos
  const isConsultor = userRole === 'consultor';
  const currentPath = location.pathname;
  if (isConsultor && RESTRICTED_FOR_CONSULTOR.some(p => currentPath === p || (p !== '/' && currentPath.startsWith(p)))) {
    return <Navigate to="/projetos" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-30 flex justify-end px-6 pt-4 pointer-events-none">
          <div className="pointer-events-auto">
            <NotificationBell />
          </div>
        </div>
        <div className="p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      <OraculoFloatingChat />
    </div>
  );
}
