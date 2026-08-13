import { useEffect, useState } from 'react';
import {
  Users,
  FolderKanban,
  Clock,
  Wallet,
  CalendarDays,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/store/hooks';
import { api } from '@/lib/api';
import { ROLES } from '@crm/shared';

interface DashboardStats {
  totalEmployees?: number;
  activeProjects?: number;
  todayAttendance?: number;
  pendingLeaves?: number;
  employees?: number;
  projects?: number;
  tasks?: number;
  myTasks?: number;
  assignedTasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    project?: { name: string } | null;
  }>;
  recentActivities?: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    user?: { firstName: string; lastName: string; email: string };
  }>;
  employeeGrowth?: Array<{ month: string; count: number }>;
  projectsByStatus?: Array<{ status: string; count: number }>;
  attendanceTrend?: Array<{ day: string; count: number }>;
  payrollExpensesTrend?: Array<{ month: string; amount: number }>;
  revenue?: { total: number; growth: number };
  totalCompanies?: number;
  activeUsers?: number;
  activeSubscriptions?: number;
  estimatedRevenue?: number;
}

export function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const role = user?.role;
  const isSystemAdmin = role === ROLES.SYSTEM_ADMIN;
  const isSuperAdmin = role === ROLES.SUPER_ADMIN || role === ROLES.SYSTEM_ADMIN;
  const isEmployee = role === ROLES.EMPLOYEE;

  useEffect(() => {
    const endpoint = isSystemAdmin ? '/platform/stats' : '/dashboard/stats';
    api
      .get(endpoint)
      .then((res) => setStats(res.data.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, [isSystemAdmin]);



  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good {getGreeting()}, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">
          {isSystemAdmin
            ? 'Platform overview and SaaS analytics'
            : isSuperAdmin
            ? 'Company overview and analytics'
            : `Your ${role?.toLowerCase().replace('_', ' ')} dashboard`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {!isEmployee && (
          <StatCard
            title="Employees"
            value={stats?.totalEmployees ?? stats?.employees ?? 0}
            icon={Users}
            trend={isSuperAdmin ? { value: 12, label: 'vs last month' } : undefined}
          />
        )}
        <StatCard
          title="Active Projects"
          value={stats?.activeProjects ?? stats?.projects ?? 0}
          icon={FolderKanban}
        />
        <StatCard
          title="Today's Attendance"
          value={stats?.todayAttendance ?? 0}
          icon={Clock}
        />
        <StatCard
          title="Pending Leaves"
          value={stats?.pendingLeaves ?? 0}
          icon={CalendarDays}
          description={isEmployee ? 'Your pending requests' : 'Awaiting approval'}
        />
        <StatCard
          title="My Tasks"
          value={stats?.myTasks ?? stats?.tasks ?? 0}
          icon={CheckSquare}
          description="Assigned to you"
        />
      </div>

      {isSystemAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
          <StatCard
            title="Total Companies"
            value={stats?.totalCompanies ?? 0}
            icon={Users}
          />
          <StatCard
            title="Total Users"
            value={stats?.activeUsers ?? 0}
            icon={Users}
          />
          <StatCard
            title="Active Subscriptions"
            value={stats?.activeSubscriptions ?? 0}
            icon={FolderKanban}
          />
          <StatCard
            title="Estimated MRR"
            value={`$${(stats?.estimatedRevenue ?? 0).toLocaleString()}`}
            icon={TrendingUp}
          />
        </div>
      )}

      {isSuperAdmin && !isSystemAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Revenue"
            value={`$${(stats?.revenue?.total ?? 0).toLocaleString()}`}
            icon={TrendingUp}
            trend={{ value: stats?.revenue?.growth ?? 8, label: 'growth' }}
          />
          <StatCard title="Open Tasks" value={stats?.tasks ?? 0} icon={CheckSquare} />
          <StatCard title="Payroll (Month)" value="—" icon={Wallet} description="Phase 3" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/40 bg-card/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Payroll Expenses</CardTitle>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">Last 6 Months</span>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.payrollExpensesTrend?.length ? stats.payrollExpensesTrend : [{ month: 'N/A', amount: 0 }]}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/50" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Expenses']}
                />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Projects Status</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="relative h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(() => {
                      const projectColors: Record<string, string> = {
                        'COMPLETED': 'hsl(var(--sidebar))',
                        'ACTIVE': '#38bdf8',
                        'ON_HOLD': '#fbbf24',
                        'PLANNING': '#a78bfa'
                      };
                      const data = stats?.projectsByStatus?.map(p => ({
                        name: p.status.replace('_', ' '),
                        value: p.count,
                        color: projectColors[p.status] || '#9ca3af'
                      })) || [];
                      return data.length ? data : [{ name: 'No Projects', value: 1, color: '#e5e7eb' }];
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {(() => {
                      const projectColors: Record<string, string> = {
                        'COMPLETED': 'hsl(var(--sidebar))',
                        'ACTIVE': '#38bdf8',
                        'ON_HOLD': '#fbbf24',
                        'PLANNING': '#a78bfa'
                      };
                      const data = stats?.projectsByStatus?.map(p => ({
                        name: p.status.replace('_', ' '),
                        value: p.count,
                        color: projectColors[p.status] || '#9ca3af'
                      })) || [];
                      const renderData = data.length ? data : [{ name: 'No Projects', value: 1, color: '#e5e7eb' }];
                      return renderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ));
                    })()}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-foreground">
                  {stats?.projectsByStatus?.reduce((acc, curr) => acc + curr.count, 0) || 0}
                </span>
                <span className="text-xs text-muted-foreground font-medium">Total</span>
              </div>
            </div>
            
            <div className="w-full mt-auto space-y-3 px-2 pb-2">
              {(() => {
                const projectColors: Record<string, string> = {
                  'COMPLETED': 'hsl(var(--sidebar))',
                  'ACTIVE': '#38bdf8',
                  'ON_HOLD': '#fbbf24',
                  'PLANNING': '#a78bfa'
                };
                return stats?.projectsByStatus?.map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: projectColors[item.status] || '#9ca3af' }} />
                      <span className="text-foreground/80 font-medium">{item.status.replace('_', ' ')}</span>
                    </div>
                    <span className="font-semibold text-foreground">{item.count}</span>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityFeed activities={stats?.recentActivities ?? []} />

        {isEmployee ? (
          <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base font-semibold">My Assigned Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!stats?.assignedTasks?.length ? (
                <p className="p-6 text-sm text-muted-foreground">No tasks assigned to you yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-4 font-medium text-muted-foreground">Task</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Project</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Priority</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.assignedTasks.map((task) => (
                        <tr key={task.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                          <td className="p-4 font-medium">{task.title}</td>
                          <td className="p-4 text-muted-foreground">{task.project?.name ?? '—'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              task.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-muted-foreground">{task.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          isSuperAdmin && (
            <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Attendance Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats?.attendanceTrend?.length ? stats.attendanceTrend : [{ day: 'N/A', count: 0 }]}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="attendanceColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/50" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#attendanceColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
