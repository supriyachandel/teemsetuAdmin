import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, Plus, Trash2, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';

interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
}

export function HolidaysPage() {
  const user = useAppSelector((s: any) => s.auth.user);
  const canManage = user?.permissions.includes(PERMISSIONS.LEAVES_APPROVE);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    date: '',
    isOptional: false,
  });

  const [awayEmployees, setAwayEmployees] = useState<any[]>([]);

  const load = async () => {
    try {
      const [holRes, awayRes] = await Promise.all([
        api.get('/holidays'),
        api.get('/leaves/who-is-away').catch(() => ({ data: { data: [] } }))
      ]);
      setHolidays(holRes.data.data ?? []);
      setAwayEmployees(awayRes.data.data ?? []);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.date) return toast.error('Name and date are required');
    
    setSubmitting(true);
    try {
      await api.post('/holidays', form);
      toast.success('Holiday added successfully');
      setForm({ name: '', date: '', isOptional: false });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${id}`);
      toast.success('Holiday deleted');
      load();
    } catch (e) {
      toast.error('Failed to delete holiday');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" />
          Company Holidays
        </h1>
        <p className="text-muted-foreground mt-1">View and manage company-wide holidays and festivals.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming & Past Holidays</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading...</div>
              ) : holidays.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No holidays found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        {canManage && <th className="text-right p-3 font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.map((h) => (
                        <tr key={h.id} className="border-b">
                          <td className="p-3 whitespace-nowrap">{new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td className="p-3 font-medium">{h.name}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${h.isOptional ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                              {h.isOptional ? 'Optional' : 'Public Holiday'}
                            </span>
                          </td>
                          {canManage && (
                            <td className="p-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(h.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

        <div className="space-y-6">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Holiday
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Holiday Name</Label>
                    <Input
                      placeholder="e.g. Christmas, Diwali"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      id="optional"
                      checked={form.isOptional}
                      onChange={(e) => setForm({ ...form, isOptional: e.target.checked })}
                    />
                    <Label htmlFor="optional" className="font-normal cursor-pointer">
                      Is this an optional holiday?
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Holiday'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Who's on Leave Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : awayEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one is currently on leave.</p>
              ) : (
                <ul className="space-y-4">
                  {awayEmployees.map(emp => (
                    <li key={emp.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={emp.avatarUrl} />
                        <AvatarFallback>{emp.employeeName.substring(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{emp.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{emp.leaveType}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
