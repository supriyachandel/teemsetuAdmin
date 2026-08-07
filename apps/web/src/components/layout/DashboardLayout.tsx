import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { cn } from '@/lib/utils';
import { getNavigationForRole } from '@/config/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchCompanyBranding } from '@/store/slices/companySlice';
import { NavLink } from 'react-router-dom';
import type { RoleName } from '@crm/shared';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyDisplayName } from './CompanyBrandMark';

export function DashboardLayout() {
  const dispatch = useAppDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAppSelector((s) => s.auth.user);
  const companyName = useCompanyDisplayName();
  const role = (user?.role || 'EMPLOYEE') as RoleName;
  const navItems = getNavigationForRole(role);

  useEffect(() => {
    if (user) {
      dispatch(fetchCompanyBranding());
    }
  }, [dispatch, user?.id]);

  return (
    <div className="flex min-h-screen bg-background relative selection:bg-primary/20 selection:text-primary">
      {/* Subtle Premium Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-background">
        <div className="absolute -top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute top-[40%] -right-[10%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <Sidebar />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-accent/30 p-4 text-sidebar-foreground">
            <div className="flex justify-between items-center mb-6">
              <span className="font-semibold truncate">{companyName}</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                      isActive ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                      {item.title}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
