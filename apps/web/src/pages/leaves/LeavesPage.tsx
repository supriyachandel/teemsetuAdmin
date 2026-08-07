import { useEffect, useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { format, startOfWeek } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { CalendarDays, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamSchedule, EmployeeSchedule } from '@/components/attendance/TeamSchedule';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  daysPerYear: number;
}

interface LeaveBalance {
  id: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  pendingDays?: number;
  leaveType: { name: string; code: string };
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  leaveType: { name: string };
  employee?: {
    employeeCode: string;
    user: { firstName: string; lastName: string };
  };
}

const getStartOfWeek = () => {
  const now = new Date();
  return startOfWeek(now, { weekStartsOn: 1 });
};

export function LeavesPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canApprove = user?.permissions.includes(PERMISSIONS.LEAVES_APPROVE);

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [employees, setEmployees] = useState<{ id: string; user: { firstName: string; lastName: string } }[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string; isOptional: boolean }[]>([]);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date; text: string[] } | null>(null);

  const [form, setForm] = useState({
    employeeId: 'self',
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [typesRes, balRes, reqRes, empRes, holRes] = await Promise.allSettled([
        api.get('/leaves/types'),
        api.get('/leaves/balances'),
        api.get('/leaves/requests', { params: { limit: 30 } }),
        canApprove ? api.get('/employees') : Promise.resolve({ data: { data: [] } }),
        api.get('/holidays'),
      ]);

      const allTypes = typesRes.status === 'fulfilled' ? (typesRes.value.data.data ?? []) : [];
      setTypes(allTypes);

      if (balRes.status === 'fulfilled') {
        setBalances(balRes.value.data.data ?? []);
      }
      if (reqRes.status === 'fulfilled') {
        setRequests(reqRes.value.data.data ?? []);
      }
      if (holRes.status === 'fulfilled') {
        setHolidays(holRes.value.data.data ?? []);
      }
      if (canApprove && empRes.status === 'fulfilled') {
        setEmployees(empRes.value.data.data ?? []);
      }

      if (!form.leaveTypeId && allTypes[0]) {
        setForm((f) => ({ ...f, leaveTypeId: allTypes[0].id }));
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const teamSchedules = useMemo(() => {
    const map = new Map<string, EmployeeSchedule>();

    requests.forEach(r => {
      if (r.status !== 'APPROVED') return; // Only show approved leaves

      const empId = r.employee?.employeeCode || 'self';
      const empName = r.employee ? `${r.employee.user.firstName} ${r.employee.user.lastName}` : 'My Leaves';

      if (!map.has(empId)) {
        map.set(empId, { id: empId, name: empName, events: [] });
      }
      
      let type: any = 'paid_leave'; // Default to paid_leave
      const typeName = r.leaveType.name.toLowerCase();
      if (typeName.includes('sick') || typeName.includes('unpaid') || typeName.includes('without pay')) {
        type = 'no_attendance';
      }

      map.get(empId)!.events.push({
        id: r.id,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        type,
      });
    });

    const schedules = Array.from(map.values());

    if (holidays.length > 0) {
      schedules.unshift({
        id: 'holidays',
        name: 'Company Holidays',
        events: holidays.map(h => ({
          id: h.id,
          startDate: new Date(h.date),
          endDate: new Date(h.date),
          type: 'holiday'
        }))
      });
    }

    return schedules;
  }, [requests, holidays]);

  useEffect(() => {
    load();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        employeeId: form.employeeId === 'self' ? '' : form.employeeId,
        autoApprove: canApprove && form.employeeId && form.employeeId !== 'self' ? true : undefined,
      };
      await api.post('/leaves/requests', payload);
      toast.success(payload.autoApprove ? 'Manual leave recorded and approved' : 'Leave request submitted');
      setForm({ employeeId: 'self', leaveTypeId: types[0]?.id ?? '', startDate: '', endDate: '', reason: '' });
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/leaves/requests/${id}/approve`);
      toast.success('Leave approved');
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      await api.post(`/leaves/requests/${id}/reject`, { rejectionReason: rejectReason });
      toast.success('Leave rejected');
      setRejectId(null);
      setRejectReason('');
      load();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const getLeaveDates = (status: string) => {
    return requests
      .filter((r) => r.status === status)
      .flatMap((r) => {
        const dates = [];
        const current = new Date(r.startDate);
        const end = new Date(r.endDate);
        while (current <= end) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
        return dates;
      });
  };

  const approvedDates = getLeaveDates('APPROVED');
  const pendingDates = getLeaveDates('PENDING');
  const holidayDates = holidays.map((h) => new Date(h.date));

  const modifiers = {
    approved: approvedDates,
    pending: pendingDates,
    holiday: holidayDates,
  };

  const modifiersStyles = {
    approved: { backgroundColor: '#22c55e', color: 'white' },
    pending: { backgroundColor: '#eab308', color: 'white' },
    holiday: { backgroundColor: '#a855f7', color: 'white' }, // Purple color for holidays
  };

  const handleDayClick = (day: Date) => {
    const texts: string[] = [];
    
    // Check for holidays
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayHolidays = holidays.filter(h => h.date.startsWith(dayStr));
    dayHolidays.forEach(h => texts.push(`🎉 Holiday: ${h.name} ${h.isOptional ? '(Optional)' : ''}`));

    // Check for leaves
    requests.forEach(r => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      const clicked = new Date(day);
      clicked.setHours(0,0,0,0);
      
      if (clicked >= start && clicked <= end) {
        texts.push(`${r.status === 'APPROVED' ? '✅' : '⏳'} ${r.leaveType.name} Request ${r.employee ? `(${r.employee.user.firstName} ${r.employee.user.lastName})` : ''} - ${r.status}`);
      }
    });

    if (texts.length > 0) {
      setSelectedDayInfo({ date: day, text: texts });
    } else {
      setSelectedDayInfo(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" />
          Leave Management
        </h1>
        <div className="flex flex-col gap-1 mt-1">
          <p className="text-muted-foreground">Apply for leave and track your balances</p>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
            * Note: Leave balances expire at the end of the year and do not carry forward.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-primary">Total Pending Leaves</p>
              <p className="text-2xl font-bold mt-1 text-primary">
                {balances.reduce((sum, b) => sum + b.totalDays, 0) - balances.reduce((sum, b) => sum + b.usedDays, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of {balances.reduce((sum, b) => sum + b.totalDays, 0)} total days · used {balances.reduce((sum, b) => sum + b.usedDays, 0)}
              </p>
            </CardContent>
          </Card>
          {balances.map((b) => (
            <Card key={b.id}>
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">{b.leaveType.name}</p>
                <p className="text-2xl font-bold mt-1">{b.remainingDays}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {b.totalDays} days · used {b.usedDays}
                  {b.pendingDays ? ` · awaiting approval ${b.pendingDays}` : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apply for Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApply} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            {canApprove && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Employee (Optional - for Manual Entry)</Label>
                <Select
                  value={form.employeeId}
                  onValueChange={(v) => setForm({ ...form, employeeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee (leave empty for yourself)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">-- Self --</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.user.firstName} {e.user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>Leave type</Label>
              <Select
                value={form.leaveTypeId}
                onValueChange={(v) => setForm({ ...form, leaveTypeId: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a leave type" />
                </SelectTrigger>
                <SelectContent>
                  {types.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No leave types available
                    </SelectItem>
                  ) : (
                    types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.daysPerYear} days/year)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <Button type="button" variant="outline" className={`w-full justify-start text-left font-normal ${!form.startDate && 'text-muted-foreground'}`}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {form.startDate ? format(new Date(form.startDate), 'PPP') : <span>Pick a date</span>}
                  </Button>
                </Popover.Trigger>
                <Popover.Content className="w-auto p-0 bg-background border rounded-md shadow-md z-50" align="start">
                  <DayPicker
                    mode="single"
                    selected={form.startDate ? new Date(form.startDate) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setForm({ ...form, startDate: format(d, 'yyyy-MM-dd') });
                      }
                    }}
                  />
                </Popover.Content>
              </Popover.Root>
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <Button type="button" variant="outline" className={`w-full justify-start text-left font-normal ${!form.endDate && 'text-muted-foreground'}`}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {form.endDate ? format(new Date(form.endDate), 'PPP') : <span>Pick a date</span>}
                  </Button>
                </Popover.Trigger>
                <Popover.Content className="w-auto p-0 bg-background border rounded-md shadow-md z-50" align="start">
                  <DayPicker
                    mode="single"
                    selected={form.endDate ? new Date(form.endDate) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setForm({ ...form, endDate: format(d, 'yyyy-MM-dd') });
                      }
                    }}
                  />
                </Popover.Content>
              </Popover.Root>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason (optional)</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Leave Calendar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col p-4 overflow-x-auto min-h-[400px]">
            <Tabs defaultValue="my-calendar" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="my-calendar">My Calendar</TabsTrigger>
                <TabsTrigger value="team-schedule">Team Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="my-calendar" className="flex flex-col items-center">
                <style>{`
                  .rdp { --rdp-cell-size: 32px; margin: 0; }
                  .rdp-day_selected { font-weight: bold; }
                  .rdp-months { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; justify-content: center; }
                `}</style>
                <DayPicker 
                  mode="multiple" 
                  modifiers={modifiers} 
                  modifiersStyles={modifiersStyles}
                  numberOfMonths={1}
                  onDayClick={handleDayClick}
                />
                {selectedDayInfo && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-md border text-sm w-full max-w-sm">
                    <p className="font-semibold mb-2">{format(selectedDayInfo.date, 'PPPP')}</p>
                    <ul className="space-y-1">
                      {selectedDayInfo.text.map((t, idx) => (
                        <li key={idx} className="text-muted-foreground">{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="team-schedule">
                <TeamSchedule startDate={getStartOfWeek()} schedules={teamSchedules} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">
              {canApprove ? 'All Leave Requests' : 'My Leave Requests'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : requests.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No leave requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {canApprove && <th className="text-left p-3 font-medium">Employee</th>}
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Dates</th>
                    <th className="text-left p-3 font-medium">Days</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    {canApprove && <th className="text-left p-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b">
                      {canApprove && (
                        <td className="p-3">
                          {r.employee
                            ? `${r.employee.user.firstName} ${r.employee.user.lastName}`
                            : '—'}
                        </td>
                      )}
                      <td className="p-3">{r.leaveType.name}</td>
                      <td className="p-3">
                        {new Date(r.startDate).toLocaleDateString()} –{' '}
                        {new Date(r.endDate).toLocaleDateString()}
                      </td>
                      <td className="p-3">{r.days}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            r.status === 'APPROVED'
                              ? 'default'
                              : r.status === 'REJECTED'
                                ? 'warning'
                                : 'outline'
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      {canApprove && (
                        <td className="p-3">
                          {r.status === 'PENDING' && (
                            <div className="flex gap-1 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => approve(r.id)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectId(r.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {rejectId === r.id && (
                            <div className="mt-2 flex gap-1">
                              <Input
                                placeholder="Reason"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="h-8 text-xs"
                              />
                              <Button size="sm" onClick={() => reject(r.id)}>
                                OK
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
