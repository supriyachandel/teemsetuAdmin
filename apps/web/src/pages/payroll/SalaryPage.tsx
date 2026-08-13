import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { IndianRupee, Pencil, Receipt, Search, Users, DollarSign } from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';

function calculateIndianSalary(ctc: number) {
  const basic = Math.round(ctc * 0.5);
  const hra = Math.round(basic * 0.5);
  const pf = Math.round(basic * 0.12);
  const pt = 200;
  const specialAllowance = ctc - basic - hra;

  return {
    baseSalary: ctc,
    allowances: [
      { label: 'Basic Salary', amount: basic },
      { label: 'HRA', amount: hra },
      { label: 'Special Allowance', amount: specialAllowance },
    ],
    deductions: [
      { label: 'Provident Fund (PF)', amount: pf },
      { label: 'Professional Tax (PT)', amount: pt },
    ],
  };
}

export function SalaryPage() {
  const user = useAppSelector((s: any) => s.auth.user);
  const canManage = user?.permissions.includes(PERMISSIONS.PAYROLL_WRITE);

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [myStructure, setMyStructure] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Modal State
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [ctcInput, setCtcInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (canManage) {
        const [empRes, structRes, deptRes] = await Promise.all([
          api.get('/employees', { params: { limit: 100 } }),
          api.get('/payroll/salary-structures'),
          api.get('/departments', { params: { limit: 100 } }),
        ]);
        setEmployees(empRes.data.data ?? []);
        setStructures(structRes.data.data ?? []);
        setDepartments(deptRes.data.data ?? []);
      } else {
        const res = await api.get('/payroll/salary-structures/me').catch(() => ({ data: { data: null } }));
        setMyStructure(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canManage]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = `${emp.user.firstName} ${emp.user.lastName} ${emp.employeeCode}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = departmentFilter === 'ALL' || emp.department?.id === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, departmentFilter]);

  const summary = useMemo(() => {
    let totalCtc = 0;
    let setEmployeesCount = 0;
    employees.forEach(emp => {
      const struct = structures.find(s => s.employeeId === emp.id);
      if (struct) {
        setEmployeesCount++;
        totalCtc += Number(struct.baseSalary);
      }
    });
    return {
      totalEmployees: employees.length,
      setEmployeesCount,
      totalCtc,
      avgCtc: setEmployeesCount > 0 ? totalCtc / setEmployeesCount : 0
    };
  }, [employees, structures]);

  const handleSaveCTC = async () => {
    if (!editingEmp || !ctcInput) return;
    const ctc = parseFloat(ctcInput);
    if (isNaN(ctc) || ctc <= 0) {
      return toast.error('Please enter a valid CTC amount');
    }

    setSaving(true);
    try {
      const payload = {
        employeeId: editingEmp.id,
        effectiveFrom: new Date().toISOString().split('T')[0],
        ...calculateIndianSalary(ctc),
      };

      await api.post('/payroll/salary-structures', payload);
      toast.success('Salary structure saved');
      setEditingEmp(null);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const renderStructureBreakdown = (struct: any, isEmployeeView = false) => {
    if (!struct) return <p className="text-muted-foreground text-sm">No salary structure defined yet.</p>;

    const allowances = struct.allowances || [];
    const deductions = struct.deductions || [];
    
    const totalEarnings = allowances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
    const totalDeductions = deductions.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const netPay = totalEarnings - totalDeductions;

    return (
      <div className="space-y-6">
        {isEmployeeView && user?.employee && (
          <div className="flex gap-4 mb-4 items-center">
            <Badge variant="outline">{user.employee.department?.name || 'No Dept'}</Badge>
            <Badge variant="secondary">{user.employee.designation?.title || 'No Designation'}</Badge>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-green-600 dark:text-green-400 border-b pb-2">Earnings</h3>
            <div className="space-y-2">
              {allowances.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">₹{Number(item.amount).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 border-t mt-4">
                <span>Total Earnings</span>
                <span>₹{totalEarnings.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-red-600 dark:text-red-400 border-b pb-2">Deductions</h3>
            <div className="space-y-2">
              {deductions.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">₹{Number(item.amount).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 border-t mt-4">
                <span>Total Deductions</span>
                <span>₹{totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">Net Take-Home Pay (Monthly)</p>
            <p className="text-2xl font-bold">₹{netPay.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Monthly CTC</p>
            <p className="text-lg font-semibold">₹{Number(struct.baseSalary).toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <IndianRupee className="h-7 w-7 text-primary" />
          Salary Details
        </h1>
        <p className="text-muted-foreground mt-1">
          {canManage 
            ? 'Manage employee salary structures and monthly CTC.' 
            : 'View your salary structure and monthly breakdown.'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : canManage ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.setEmployeesCount} with salary set
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly CTC Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary.totalCtc.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Total structured monthly cost
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Monthly CTC</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{Math.round(summary.avgCtc).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Per employee with set salary
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <CardTitle className="text-base w-full">Employee Salary Structures</CardTitle>
                <div className="flex gap-4 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      {departments.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium">Employee</th>
                      <th className="text-left p-4 font-medium">Department</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="text-left p-4 font-medium">Monthly CTC</th>
                      <th className="text-left p-4 font-medium">Net Pay</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => {
                      const struct = structures.find(s => s.employeeId === emp.id);
                      const allowances = struct?.allowances || [];
                      const deductions = struct?.deductions || [];
                      const earnings = allowances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
                      const deds = deductions.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
                      const net = struct ? earnings - deds : null;

                      return (
                        <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="font-medium">{emp.user.firstName} {emp.user.lastName}</div>
                            <div className="text-xs text-muted-foreground">{emp.employeeCode || '-'}</div>
                          </td>
                          <td className="p-4">
                            <div>{emp.department?.name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{emp.designation?.title || ''}</div>
                          </td>
                          <td className="p-4">
                            {struct ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Set</Badge>
                            ) : (
                              <Badge variant="secondary">Not Set</Badge>
                            )}
                          </td>
                          <td className="p-4 font-medium">
                            {struct ? `₹${Number(struct.baseSalary).toLocaleString()}` : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="p-4">
                            {net !== null ? `₹${net.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingEmp(emp);
                                setCtcInput(struct ? String(struct.baseSalary) : '');
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              {struct ? 'Edit' : 'Set Salary'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No employees found matching the filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Your Salary Structure</CardTitle>
            </div>
            <CardDescription>
              Breakdown of your monthly earnings and deductions according to the Indian payroll system.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {renderStructureBreakdown(myStructure, true)}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingEmp} onOpenChange={(open) => !open && setEditingEmp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Salary Structure</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {editingEmp && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Employee:</span>
                <span className="font-medium text-foreground">{editingEmp.user.firstName} {editingEmp.user.lastName}</span>
                <Badge variant="outline">{editingEmp.department?.name || 'No Dept'}</Badge>
              </div>
            )}
            <div className="space-y-2 pt-2">
              <Label>Monthly CTC (₹)</Label>
              <Input 
                type="number"
                placeholder="Enter total monthly cost to company"
                value={ctcInput}
                onChange={(e) => setCtcInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Basic, HRA, PF, and other components will be automatically calculated based on standard Indian payroll structures.
              </p>
            </div>
            {ctcInput && !isNaN(parseFloat(ctcInput)) && parseFloat(ctcInput) > 0 && (
              <div className="bg-muted p-4 rounded-md text-sm space-y-3 mt-4 border">
                <p className="font-semibold border-b pb-2">Preview Breakdown</p>
                {(() => {
                  const s = calculateIndianSalary(parseFloat(ctcInput));
                  return (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Basic Salary</p>
                        <p className="font-medium">₹{s.allowances[0].amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">HRA</p>
                        <p className="font-medium">₹{s.allowances[1].amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">PF Deduction</p>
                        <p className="font-medium text-red-600">₹{s.deductions[0].amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Net Take-Home Pay</p>
                        <p className="font-bold text-green-600 text-lg">
                          ₹{(
                            s.allowances.reduce((acc, a) => acc + a.amount, 0) -
                            s.deductions.reduce((acc, d) => acc + d.amount, 0)
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmp(null)}>Cancel</Button>
            <Button onClick={handleSaveCTC} disabled={saving}>
              {saving ? 'Saving...' : 'Save Structure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
