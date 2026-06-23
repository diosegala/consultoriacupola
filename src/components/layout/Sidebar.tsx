import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Kanban,
  Link2,
  ListChecks,
  Video,
  CalendarDays
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import cupolaLogoBranca from '@/assets/cupola-logo-branca.png';
import cupolaIcon from '@/assets/cupola-icon.png';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const adminMenuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/contratos', icon: FileText, label: 'Contratos' },
  { to: '/consultores', icon: UserCog, label: 'Consultores' },
  { to: '/projetos', icon: Kanban, label: 'Projetos' },
  { to: '/reunioes', icon: Video, label: 'Reuniões' },
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/minhas-tarefas', icon: ListChecks, label: 'Minhas tarefas' },
  { to: '/integracoes', icon: Link2, label: 'Minhas Integrações' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

const consultorMenuItems = [
  { to: '/projetos', icon: Kanban, label: 'Projetos' },
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/minhas-tarefas', icon: ListChecks, label: 'Minhas tarefas' },
  { to: '/integracoes', icon: Link2, label: 'Minhas Integrações' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user, isConsultor } = useAuth();
  const location = useLocation();

  const menuItems = isConsultor ? consultorMenuItems : adminMenuItems;

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
      {!collapsed ? (
          <img src={cupolaLogoBranca} alt="Cupola Consultoria" className="h-8 object-contain" />
        ) : (
          <img src={cupolaIcon} alt="Cupola" className="h-6 object-contain mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/' && location.pathname.startsWith(item.to));
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
                collapsed && "justify-center"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed && user && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed ? "justify-center px-2" : "justify-start"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
