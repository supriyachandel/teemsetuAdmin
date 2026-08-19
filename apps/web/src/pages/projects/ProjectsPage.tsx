import { useEffect, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';

interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
  progress: number;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
}

export function ProjectsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canWrite = user?.permissions.includes(PERMISSIONS.PROJECTS_WRITE);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    status: 'PLANNING',
    startDate: '',
    endDate: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects', { params: { limit: 50 } });
      setProjects(res.data.data ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/projects', {
        ...form,
        code: form.code || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      toast.success('Project created');
      setShowForm(false);
      setForm({ name: '', code: '', description: '', status: 'PLANNING', startDate: '', endDate: '' });
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-7 w-7 text-primary" />
            Projects
          </h1>
          <p className="text-muted-foreground">Create and track company projects</p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      {showForm && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Project'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No projects yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {canWrite ? (
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium"
                      value={p.status}
                      onChange={async (e) => {
                        try {
                          await api.patch(`/projects/${p.id}`, { status: e.target.value });
                          toast.success('Project status updated');
                          load();
                        } catch (err) {
                          toast.error(getApiErrorMessage(err));
                        }
                      }}
                    >
                      <option value="PLANNING">Planning</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  ) : (
                    <Badge variant="outline">{p.status}</Badge>
                  )}
                </div>
                {p.code && <p className="text-xs font-mono text-muted-foreground">{p.code}</p>}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{p.description || 'No description'}</p>
                <div className="flex justify-between items-center">
                  <span>Progress</span>
                  {canWrite ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 h-8 text-right p-1 text-xs"
                        value={p.progress}
                        onChange={async (e) => {
                          const val = parseInt(e.target.value);
                          if (isNaN(val) || val < 0 || val > 100) return;
                          
                          // Optimistically update UI local state first
                          setProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, progress: val } : proj));
                          
                          try {
                            await api.patch(`/projects/${p.id}`, { progress: val });
                          } catch (err) {
                            toast.error(getApiErrorMessage(err));
                            load();
                          }
                        }}
                      />
                      <span className="text-xs">%</span>
                    </div>
                  ) : (
                    <span className="font-medium">{p.progress}%</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
