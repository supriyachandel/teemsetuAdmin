import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getApiErrorMessage } from '@/lib/api';

interface CompanySettings {
  officeStartTime: string;
  officeEndTime: string;
  workDays: number[];
  lateThresholdMin: number;
  emailNotifications: boolean;
  theme: 'light' | 'dark' | 'system';
  linkedinToken?: string;
}

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CompanySettings & { employeeCodePrefix?: string }>({
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    workDays: [1, 2, 3, 4, 5],
    lateThresholdMin: 15,
    emailNotifications: true,
    theme: 'system',
    employeeCodePrefix: 'EMP',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      if (res.data.data) {
        setForm({
          officeStartTime: res.data.data.officeStartTime ?? '09:00',
          officeEndTime: res.data.data.officeEndTime ?? '18:00',
          workDays: res.data.data.workDays ?? [1, 2, 3, 4, 5],
          lateThresholdMin: res.data.data.lateThresholdMin ?? 15,
          emailNotifications: res.data.data.emailNotifications ?? true,
          theme: res.data.data.theme ?? 'system',
          employeeCodePrefix: res.data.data.employeeCodePrefix ?? 'EMP',
          linkedinToken: res.data.data.linkedinToken ?? '',
        });
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleWorkDay = (day: number) => {
    setForm((prev) => {
      const has = prev.workDays.includes(day);
      const workDays = has ? prev.workDays.filter((d) => d !== day) : [...prev.workDays, day];
      return { ...prev, workDays: workDays.sort((a, b) => a - b) };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', form);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground">Configure office hours, notifications, and theme preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Office start</Label>
            <Input
              type="time"
              value={form.officeStartTime}
              onChange={(e) => setForm({ ...form, officeStartTime: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Office end</Label>
            <Input
              type="time"
              value={form.officeEndTime}
              onChange={(e) => setForm({ ...form, officeEndTime: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Late threshold (min)</Label>
            <Input
              type="number"
              min={0}
              max={180}
              value={form.lateThresholdMin}
              onChange={(e) =>
                setForm({ ...form, lateThresholdMin: Number(e.target.value || 0) })
              }
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Employee ID Prefix</Label>
            <Input
              type="text"
              placeholder="e.g. EMP"
              maxLength={10}
              value={form.employeeCodePrefix}
              onChange={(e) => setForm({ ...form, employeeCodePrefix: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Theme</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value as CompanySettings['theme'] })}
              disabled={loading}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>Work days</Label>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((name, idx) => {
                const active = form.workDays.includes(idx);
                return (
                  <Button
                    key={name}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleWorkDay(idx)}
                    disabled={loading}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="emailNotifications"
              type="checkbox"
              checked={form.emailNotifications}
              onChange={(e) => setForm({ ...form, emailNotifications: e.target.checked })}
              disabled={loading}
            />
            <Label htmlFor="emailNotifications">Enable email notifications</Label>
          </div>

          <div className="sm:col-span-2">
            <Button onClick={save} disabled={loading || saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>LinkedIn API Token</Label>
            <Input
              type="password"
              placeholder="Enter your LinkedIn OAuth Access Token"
              value={form.linkedinToken || ''}
              onChange={(e) => setForm({ ...form, linkedinToken: e.target.value })}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Required to automatically post jobs to LinkedIn. Obtain this from the LinkedIn Developer Portal.
            </p>
          </div>
          <Button onClick={save} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Save Integrations'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
