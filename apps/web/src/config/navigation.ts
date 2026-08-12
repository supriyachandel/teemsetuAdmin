import {
  Briefcase,
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  FolderKanban,
  CheckSquare,
  BarChart3,
  Bell,
  Settings,
  UserCog,
  Building2,
  CreditCard,
  Palette,
  MessageSquare,
  PartyPopper,
  Cake,
  type LucideIcon,
} from 'lucide-react';
import { ROLES, type RoleName } from '@crm/shared';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: RoleName[];
  badge?: string;
}

export const mainNavigation: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    title: 'Employees',
    href: '/employees',
    icon: Users,
    roles: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.MANAGER],
  },
  {
    title: 'Recruitment',
    href: '/jobs',
    icon: Briefcase,
    roles: [ROLES.SUPER_ADMIN, ROLES.HR],
  },
  { title: 'Attendance', href: '/attendance', icon: Clock },
  { title: 'Leaves', href: '/leaves', icon: CalendarDays },
  { title: 'Birthdays', href: '/birthdays', icon: Cake },
  { title: 'Holidays', href: '/holidays', icon: PartyPopper },
  {
    title: 'Payroll',
    href: '/payroll',
    icon: Wallet,
    roles: [ROLES.SUPER_ADMIN, ROLES.HR],
  },
  { title: 'Projects', href: '/projects', icon: FolderKanban },
  { title: 'Tasks', href: '/tasks', icon: CheckSquare },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: [ROLES.SUPER_ADMIN, ROLES.HR, ROLES.MANAGER],
  },
  { title: 'Notifications', href: '/notifications', icon: Bell },
  { title: 'Chat', href: '/chat', icon: MessageSquare },
];

export const platformNavigation: NavItem[] = [
  {
    title: 'Companies',
    href: '/platform/companies',
    icon: Building2,
    roles: [ROLES.SYSTEM_ADMIN],
  },
];

export const adminNavigation: NavItem[] = [
  {
    title: 'User Management',
    href: '/admin/users',
    icon: UserCog,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    title: 'Roles',
    href: '/admin/roles',
    icon: Building2,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    title: 'Subscription',
    href: '/subscriptions',
    icon: CreditCard,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    title: 'Company Branding',
    href: '/company/branding',
    icon: Palette,
    roles: [ROLES.SUPER_ADMIN, ROLES.HR],
  },
  { title: 'Settings', href: '/settings', icon: Settings, roles: [ROLES.SUPER_ADMIN, ROLES.HR] },
];

export function getNavigationForRole(role: RoleName): NavItem[] {
  if (role === ROLES.SYSTEM_ADMIN) {
    return [...mainNavigation, ...adminNavigation, ...platformNavigation];
  }
  
  const filter = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(role));
  
  return [...filter(mainNavigation), ...filter(adminNavigation)];
}
