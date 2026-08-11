import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS, ROLES } from '@crm/shared';
import { formatLastChange, formatLastChangeDate, type LastChange } from '@/lib/audit';

interface Employee {
  id: string;
  employeeCode: string;
  employmentStatus: string;
  joiningDate: string;
  phone?: string | null;
  user: { firstName: string; lastName: string; email: string };
  department?: { id: string; name: string } | null;
  designation?: { id: string; title: string } | null;
  manager?: {
    id: string;
    user: { firstName: string; lastName: string };
  } | null;
  lastChange?: LastChange | null;
}

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  title: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
}

const emptyCreateForm = {
  email: '',
  firstName: '',
  lastName: '',
  employeeCode: '',
  departmentId: '',
  designationId: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  phone: '',
  password: '',
  managerId: '',
  roleId: '',
  baseSalary: '',
};

export function EmployeesPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canWrite = user?.permissions.includes(PERMISSIONS.EMPLOYEES_WRITE);
  const canDelete = user?.role === ROLES.SUPER_ADMIN;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(emptyCreateForm);

  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    departmentId: '',
    designationId: '',
    managerId: '',
    roleId: '',
    phone: '',
    employmentStatus: 'ACTIVE',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, desigRes, rolesRes] = await Promise.all([
        api.get('/employees', { params: { search: search || undefined, limit: 50 } }),
        api.get('/employees/departments'),
        api.get('/employees/designations'),
        api.get('/roles').catch(() => ({ data: { data: [] } })),
      ]);
      setEmployees(empRes.data.data ?? []);
      setDepartments(deptRes.data.data ?? []);
      setDesignations(desigRes.data.data ?? []);
      setRoles(rolesRes.data.data ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password && form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/employees', {
        ...form,
        departmentId: form.departmentId || undefined,
        designationId: form.designationId || undefined,
        employeeCode: form.employeeCode.trim() || undefined,
        phone: form.phone || undefined,
        password: form.password || undefined,
        managerId: form.managerId || undefined,
        roleId: form.roleId || undefined,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : undefined,
      });
      const loginPassword = form.password || 'Password@123';
      toast.success(`Employee created. Login password: ${loginPassword}`, {
        duration: 4000,
      });
      setShowForm(false);
      setForm({ ...emptyCreateForm, joiningDate: new Date().toISOString().slice(0, 10) });
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setShowForm(false);
    setEditForm({
      firstName: emp.user.firstName,
      lastName: emp.user.lastName,
      departmentId: emp.department?.id ?? '',
      designationId: emp.designation?.id ?? '',
      managerId: emp.manager?.id ?? '',
      roleId: (emp.user as any)?.role?.id ?? '',
      phone: emp.phone ?? '',
      employmentStatus: emp.employmentStatus,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    try {
      await api.patch(`/employees/${editingId}`, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        departmentId: editForm.departmentId || null,
        designationId: editForm.designationId || null,
        managerId: editForm.managerId || null,
        roleId: editForm.roleId || null,
        phone: editForm.phone || null,
        employmentStatus: editForm.employmentStatus,
      });
      toast.success('Employee updated');
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (
      !window.confirm(
        `Delete ${emp.user.firstName} ${emp.user.lastName}? This deactivates their account.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/employees/${emp.id}`);
      toast.success('Employee deleted');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Employees
          </h1>
          <p className="text-muted-foreground">Manage employee profiles and org structure</p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        )}
      </div>

      {showForm && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Employee code (optional)</Label>
                <Input
                  placeholder="Leave blank to auto-generate"
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Base Salary (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.designationId}
                  onChange={(e) => setForm({ ...form, designationId: e.target.value })}
                >
                  <option value="">—</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>System Role</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                >
                  <option value="">— Default (Employee) —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Reporting manager</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                >
                  <option value="">—</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.user.firstName} {e.user.lastName} ({e.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Joining date</Label>
                <Input
                  type="date"
                  required
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Login password (optional)</Label>
                <Input
                  type="password"
                  placeholder="Leave blank for default: Password@123"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  A login account is created automatically using the email above. If you leave
                  password blank, the default is <strong>Password@123</strong> — share it with the
                  employee so they can sign in.
                </p>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Employee'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editingId && canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input
                  required
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.designationId}
                  onChange={(e) => setEditForm({ ...editForm, designationId: e.target.value })}
                >
                  <option value="">—</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>System Role</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.roleId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                >
                  <option value="">— Unchanged —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Reporting manager</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.managerId}
                  onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                >
                  <option value="">—</option>
                  {employees
                    .filter((e) => e.id !== editingId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.user.firstName} {e.user.lastName} ({e.employeeCode})
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.employmentStatus}
                  onChange={(e) => setEditForm({ ...editForm, employmentStatus: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="TERMINATED">TERMINATED</option>
                  <option value="RESIGNED">RESIGNED</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <p className="p-6 text-muted-foreground text-sm">No employees found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Department</th>
                    <th className="text-left p-3 font-medium">Designation</th>
                    <th className="text-left p-3 font-medium">System Role</th>
                    <th className="text-left p-3 font-medium">Reporting Manager</th>
                    <th className="text-left p-3 font-medium">Last changed</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    {(canWrite || canDelete) && (
                      <th className="text-left p-3 font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{emp.employeeCode}</td>
                      <td className="p-3">
                        <p className="font-medium">
                          {emp.user.firstName} {emp.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{emp.user.email}</p>
                      </td>
                      <td className="p-3">{emp.department?.name ?? '—'}</td>
                      <td className="p-3">{emp.designation?.title ?? '—'}</td>
                      <td className="p-3">{(emp.user as any)?.role?.displayName ?? '—'}</td>
                      <td className="p-3">
                        {emp.manager
                          ? `${emp.manager.user.firstName} ${emp.manager.user.lastName}`
                          : '—'}
                      </td>
                      <td className="p-3 text-xs">
                        <p>{formatLastChange(emp.lastChange)}</p>
                        {emp.lastChange?.at && (
                          <p className="text-muted-foreground">{formatLastChangeDate(emp.lastChange)}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{emp.employmentStatus}</Badge>
                      </td>
                      {(canWrite || canDelete) && (
                        <td className="p-3">
                          <div className="flex gap-1">
                            {canWrite && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(emp)}
                                title="Edit employee"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(emp)}
                                title="Delete employee"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
  );
}
