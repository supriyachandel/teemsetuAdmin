import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cake, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';

interface Employee {
  id: string;
  user: { firstName: string; lastName: string; email: string };
  dateOfBirth?: string | null;
}

export function BirthdaysPage() {
  const user = useAppSelector((s: any) => s.auth.user);
  const canManage = user?.permissions.includes(PERMISSIONS.EMPLOYEES_WRITE) || user?.permissions.includes(PERMISSIONS.LEAVES_APPROVE);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/employees/birthdays');
      setEmployees(res.data.data ?? []);
    } catch (e) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (id: string) => {
    if (!editDate) return;
    setSubmitting(true);
    try {
      await api.patch(`/employees/${id}/birthday`, { dateOfBirth: editDate });
      toast.success('Birthday updated');
      setEditingId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update birthday');
    } finally {
      setSubmitting(false);
    }
  };

  // Process upcoming birthdays
  const currentMonth = new Date().getMonth();
  const currentDay = new Date().getDate();

  const upcomingBirthdays = employees
    .filter((e) => e.dateOfBirth)
    .map((e) => {
      const dob = new Date(e.dateOfBirth!);
      const month = dob.getMonth();
      const day = dob.getDate();
      
      // Calculate next occurrence
      let nextOccurrence = new Date(new Date().getFullYear(), month, day);
      if (month < currentMonth || (month === currentMonth && day < currentDay)) {
        nextOccurrence = new Date(new Date().getFullYear() + 1, month, day);
      }
      
      return { ...e, month, day, nextOccurrence };
    })
    .sort((a, b) => a.nextOccurrence.getTime() - b.nextOccurrence.getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Cake className="h-7 w-7 text-pink-500" />
          Birthdays
        </h1>
        <p className="text-muted-foreground mt-1">Celebrate upcoming birthdays with your team.</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Birthdays</TabsTrigger>
          {canManage && <TabsTrigger value="manage">Manage Birthdays (HR)</TabsTrigger>}
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next 365 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : upcomingBirthdays.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  <Cake className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  No birthdays recorded yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingBirthdays.map((e) => (
                    <div key={e.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400">
                        <Cake className="h-6 w-6" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-medium truncate">{e.user.firstName} {e.user.lastName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(e.dateOfBirth!).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-xs font-semibold text-pink-500 bg-pink-50 dark:bg-pink-500/10 px-2 py-1 rounded-full whitespace-nowrap">
                        {e.nextOccurrence.getFullYear() === new Date().getFullYear() && e.nextOccurrence.getMonth() === currentMonth && e.nextOccurrence.getDate() === currentDay 
                          ? 'Today!' 
                          : `${Math.ceil((e.nextOccurrence.getTime() - new Date().getTime()) / (1000 * 3600 * 24))} days`
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="manage" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Employee Birth Dates</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-4 font-medium">Employee</th>
                        <th className="text-left p-4 font-medium">Email</th>
                        <th className="text-left p-4 font-medium">Date of Birth</th>
                        <th className="text-right p-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((e) => (
                        <tr key={e.id} className="border-b last:border-0">
                          <td className="p-4 font-medium">{e.user.firstName} {e.user.lastName}</td>
                          <td className="p-4 text-muted-foreground">{e.user.email}</td>
                          <td className="p-4">
                            {editingId === e.id ? (
                              <Input
                                type="date"
                                value={editDate}
                                onChange={(evt) => setEditDate(evt.target.value)}
                                className="h-8 max-w-[200px]"
                              />
                            ) : (
                              e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString() : <span className="text-muted-foreground italic">Not set</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {editingId === e.id ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => handleUpdate(e.id)} disabled={submitting}>
                                  <Save className="h-4 w-4 mr-1" /> Save
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => { setEditingId(e.id); setEditDate(e.dateOfBirth ? e.dateOfBirth.split('T')[0] : ''); }}>
                                Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
