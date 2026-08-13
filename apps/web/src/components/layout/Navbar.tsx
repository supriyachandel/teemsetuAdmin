import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Moon,
  Sun,
  LogOut,
  Menu,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { setTheme } from '@/store/slices/themeSlice';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { setNotifications } from '@/store/slices/notificationSlice';
import { NotificationPanel } from './NotificationPanel';
import { GlobalSearch } from './GlobalSearch';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.theme.theme);

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`
    : 'U';

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  const toggleTheme = () => {
    dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    api
      .get('/notifications/unread', { params: { limit: 20 } })
      .then((res) => dispatch(setNotifications(res.data.data ?? [])))
      .catch(() => null);
  }, [dispatch]);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border/40 bg-background/60 backdrop-blur-xl px-4 lg:px-6 transition-all duration-300">
      <Button variant="ghost" size="icon" className="lg:hidden hover:bg-muted/50" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NotificationPanel />

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:bg-muted/50 transition-colors">
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="hover:bg-muted/50 transition-colors">
          <User className="h-5 w-5" />
        </Button>

        <div className="hidden md:flex items-center gap-3 pl-3 ml-1 border-l border-border/40">
          <Avatar className="h-8 w-8 ring-2 ring-primary/10 transition-all hover:ring-primary/30">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium leading-none mb-1.5">
              {user?.firstName} {user?.lastName}
            </p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-sm bg-primary/10 text-primary border-none">
              {user?.role}
            </Badge>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive transition-colors ml-1">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
