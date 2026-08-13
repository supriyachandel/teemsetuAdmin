import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatTime } from '@/lib/date';
import { AttendanceRequestModal } from '@/components/attendance/AttendanceRequestModal';
import { AttendanceRequestsList } from '@/components/attendance/AttendanceRequestsList';
import { useAppSelector } from '@/store/hooks';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workHours: number | null;
  isLate: boolean;
  employee?: {
    employeeCode: string;
    user: { firstName: string; lastName: string };
  };
}

interface TodayRecord {
  id: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workHours: number | null;
  isLate: boolean;
}

export function AttendancePage() {
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const user = useAppSelector((state) => state.auth.user);
  const canViewAll = user?.permissions?.includes('attendance:approve');

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [todayRes, listRes, countRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/attendance', { params: { limit: 20 } }),
        api.get('/attendance/requests/count', { params: { month: now.getMonth() + 1, year: now.getFullYear() } }),
      ]);
      setToday(todayRes.data.data ?? null);
      setHistory(listRes.data.data ?? []);
      setMonthlyCount(countRes.data.data?.count ?? 0);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const checkIn = async () => {
    if (!canCheckIn) return;
    setActionLoading(true);
    try {
      const res = await api.post('/attendance/check-in', {});
      setToday(res.data.data ?? null);
      toast.success('Checked in successfully');
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const checkOut = async () => {
    if (!canCheckOut) return;
    setActionLoading(true);
    try {
      const res = await api.post('/attendance/check-out', {});
      if (today && res.data.data) {
        setToday({ ...today, ...res.data.data });
      }
      toast.success('Checked out successfully');
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const canCheckIn = !today?.checkIn;
  const canCheckOut = Boolean(today?.checkIn && !today?.checkOut);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-7 w-7 text-primary" />
            Attendance
          </h1>
          <p className="text-muted-foreground">Check in, check out, and view your attendance history</p>
        </div>
        <Button variant="outline" onClick={() => setIsModalOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Attendance
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {today ? (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge className="mt-1">{today.status}</Badge>
                      {today.isLate && (
                        <Badge variant="warning" className="ml-2 mt-1">
                          Late
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Check in</p>
                      <p className="font-medium">{today.checkIn ? formatTime(today.checkIn) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Check out</p>
                      <p className="font-medium">{today.checkOut ? formatTime(today.checkOut) : '—'}</p>
                    </div>
                    {today.workHours != null && (
                      <div>
                        <p className="text-muted-foreground">Work hours</p>
                        <p className="font-medium">{today.workHours}h</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attendance record for today yet.</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant={canCheckIn ? 'default' : 'outline'}
                    onClick={checkIn}
                    disabled={!canCheckIn || actionLoading}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Check In
                  </Button>
                  <Button
                    variant={canCheckOut ? 'default' : 'outline'}
                    onClick={checkOut}
                    disabled={!canCheckOut || actionLoading}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Check Out
                  </Button>
                </div>
                {today?.checkIn && !today.checkOut && (
                  <p className="text-xs text-muted-foreground">
                    You are checked in. Use Check Out when you finish for the day.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : history.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Date</th>
                        {canViewAll && <th className="text-left p-3 font-medium">Employee</th>}
                        <th className="text-left p-3 font-medium">In</th>
                        <th className="text-left p-3 font-medium">Out</th>
                        <th className="text-left p-3 font-medium">Hours</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="p-3">{new Date(r.date).toLocaleDateString()}</td>
                          {canViewAll && (
                            <td className="p-3">
                              {r.employee
                                ? `${r.employee.user.firstName} ${r.employee.user.lastName}`
                                : '—'}
                            </td>
                          )}
                          <td className="p-3">{r.checkIn ? formatTime(r.checkIn) : '—'}</td>
                          <td className="p-3">{r.checkOut ? formatTime(r.checkOut) : '—'}</td>
                          <td className="p-3">{r.workHours ?? '—'}</td>
                          <td className="p-3">
                            <Badge variant="outline">{r.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AttendanceRequestsList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AttendanceRequestModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={() => {
          load();
        }}
        monthlyCount={monthlyCount}
      />
    </div>
  );
}
