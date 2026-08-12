import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getNavigationForRole } from '@/config/navigation';
import { useAppSelector } from '@/store/hooks';
import { ROLE_LABELS, type RoleName } from '@crm/shared';
import { Badge } from '@/components/ui/badge';
import { CompanyBrandMark, useCompanyDisplayName } from './CompanyBrandMark';

export function Sidebar() {
  const user = useAppSelector((s) => s.auth.user);
  const companyName = useCompanyDisplayName();
  const role = (user?.role || 'EMPLOYEE') as RoleName;
  const navItems = getNavigationForRole(role);

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-sidebar-accent/30 bg-sidebar text-sidebar-foreground z-30">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-accent/30 px-6">
        <CompanyBrandMark />
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate text-sidebar-foreground">{companyName}</p>
          <p className="text-xs text-sidebar-foreground/70 font-medium">Enterprise Suite</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto scrollbar-none">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                  : 'text-sidebar-foreground opacity-60 hover:opacity-100 hover:bg-sidebar-accent/50'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-sidebar-foreground")} />
                <span className="relative z-10">{item.title}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-accent/30 p-4">
        <Badge variant="outline" className="w-full justify-center py-1.5 bg-sidebar-accent/20 border-sidebar-accent/50 text-sidebar-foreground shadow-sm">
          <span className="font-semibold">
            {ROLE_LABELS[role]}
          </span>
        </Badge>
      </div>
    </aside>
  );
}
