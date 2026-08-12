import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, Mail, Lock, Users, UserCircle, Banknote, CalendarCheck, FolderKanban, ListTodo, Plane, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { login, clearError } from '@/store/slices/authSlice';
import { toast } from 'sonner';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);



export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    const result = await dispatch(login({ email, password }));
    if (login.fulfilled.match(result)) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error((result.payload as string) || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex bg-background selection:bg-primary/20 selection:text-primary">
      <div className="relative hidden lg:flex lg:w-[55%] overflow-hidden flex-col p-12 bg-slate-50 dark:bg-background">
        <div className="relative z-10 mb-12 flex items-center gap-2">
          <img src="/logo.png" alt="Team Setu" className="h-8 w-auto object-contain" />
          <span className="text-xl font-bold text-slate-800 dark:text-foreground tracking-tight">TeemSetu</span>
        </div>

        <div className="relative z-10 mb-8 max-w-2xl">
          <h1 className="text-5xl lg:text-[3rem] font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-white mb-5">
            Run Your Entire Business <br />
            from <span className="text-primary">One Connected <br /> Platform</span>
          </h1>
          <p className="text-base lg:text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-[500px]">
            Team Setu brings together CRM, HRMS, Projects, Payroll,
            Attendance and more to streamline operations, empower teams
            and grow your business.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-4 gap-3 lg:gap-4 max-w-[550px]">
          {[
            { name: 'CRM', icon: Users },
            { name: 'HRMS', icon: UserCircle },
            { name: 'Payroll', icon: Banknote },
            { name: 'Attendance', icon: CalendarCheck },
            { name: 'Projects', icon: FolderKanban },
            { name: 'Tasks', icon: ListTodo },
            { name: 'Leave Management', icon: Plane },
            { name: 'Reports', icon: BarChart2 }
          ].map((feature, i) => (
            <div key={i} className="bg-white dark:bg-card rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm border border-slate-100 dark:border-border/40 hover:shadow-md hover:border-primary/20 transition-all group">
              <div className="h-10 w-10 bg-primary/5 dark:bg-primary/20 rounded-full flex items-center justify-center mb-2.5 group-hover:bg-primary/10 transition-colors">
                <feature.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight group-hover:text-primary transition-colors">{feature.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-gray-50 dark:bg-background">
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] z-0 pointer-events-none" />
        <div className="absolute bottom-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[100px] z-0 pointer-events-none" />

        <Card className="w-full max-w-[440px] border-border/40 shadow-xl bg-white dark:bg-card relative z-10 p-1 sm:p-2 rounded-2xl max-h-[95vh] overflow-y-auto scrollbar-none">
          <CardContent className="pt-6 px-6 sm:px-8 pb-6">
            <div className="text-center mb-6">
              <img src="/logo.png" alt="Team Setu Logo" className="h-14 w-auto mx-auto mb-4 object-contain" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1.5">Welcome back!</h1>
              <p className="text-sm text-muted-foreground">Sign in to access your workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-11 pl-11 bg-white dark:bg-background border-border/60 hover:border-border transition-colors rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground">Password</Label>
                  <Link to="/forgot-password" className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11 pl-11 pr-11 bg-white dark:bg-background border-border/60 hover:border-border transition-colors rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" id="remember" className="rounded-sm border-border text-primary focus:ring-primary h-4 w-4 accent-primary cursor-pointer" />
                <Label htmlFor="remember" className="text-sm font-medium text-foreground cursor-pointer">Remember me</Label>
              </div>

              {error && <p className="text-sm text-destructive font-medium">{error}</p>}

              <Button type="submit" className="w-full h-11 text-base font-medium shadow-md transition-all hover:shadow-lg active:scale-[0.98] rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground mt-3" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-card px-3 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <Button type="button" variant="outline" className="w-full h-11 bg-white dark:bg-background border-border/60 hover:bg-muted/30 rounded-xl font-medium justify-center gap-3 text-foreground">
                <GoogleIcon />
                Continue with Google
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to Team Setu?{' '}
              <Link to="/register" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
