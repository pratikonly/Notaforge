import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, Archive, Trash2, Settings, X, Shield,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSidebarContext } from './MainLayout';

const navItems = [
  { title: 'Home', url: '/', icon: Home },
  { title: 'Archive', url: '/archive', icon: Archive },
  { title: 'Bin', url: '/bin', icon: Trash2 },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isMobileOpen, setIsMobileOpen } = useSidebarContext();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (url: string) => {
    navigate(url);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-card border-r border-border z-40 transition-all duration-300 flex flex-col",
          isCollapsed ? "w-16" : "w-56",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 p-4 border-b border-border",
          isCollapsed && "justify-center"
        )}>
          {/* Close button for mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          {!isCollapsed && (
            <h1 className="text-lg font-bold font-mono">
              PA<span className="text-primary">lock</span>
            </h1>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.url}
              onClick={() => handleNavigation(item.url)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive(item.url)
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.title}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle - desktop only */}
        <div className="hidden md:block p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn("w-full", isCollapsed && "px-2")}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Spacer for main content */}
      <div className={cn(
        "hidden md:block flex-shrink-0 transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )} />
    </>
  );
}
