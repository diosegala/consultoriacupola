import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { OraculoFloatingChat } from '@/components/oraculo/OraculoFloatingChat';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  const { user, loading, roleLoading, userRole, forcePasswordChange } = useAuth();

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
  const restrictedPaths = ['/', '/clientes', '/contratos', '/consultores', '/configuracoes'];
  const currentPath = window.location.pathname;
  if (isConsultor && restrictedPaths.some(p => currentPath === p || (p !== '/' && currentPath.startsWith(p)))) {
    return <Navigate to="/projetos" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
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
