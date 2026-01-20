import { Menu, Shield, User, LogOut } from 'lucide-react';
import { useSidebarContext } from './MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  showAccountMenu?: boolean;
}

export function PageHeader({ title, description, icon, actions, showAccountMenu = true }: PageHeaderProps) {
  const { setIsMobileOpen } = useSidebarContext();
  const { user, signOut } = useAuth();

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  return (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-1.5 sm:p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </button>
            
            {/* Logo */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <span className="font-semibold text-foreground hidden sm:block text-sm sm:text-base">PAlock</span>
            </div>

            <div className="h-5 sm:h-6 w-px bg-border mx-1 sm:mx-2 hidden sm:block" />

            {/* Page title */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {icon && (
                <div className="p-1 sm:p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  {icon}
                </div>
              )}
              <div>
                <h1 className="text-sm sm:text-lg font-semibold text-foreground">{title}</h1>
                {description && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {actions}
            
            {/* Account Menu */}
            {showAccountMenu && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-foreground">{username}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
