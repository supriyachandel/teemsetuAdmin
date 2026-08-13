import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { IndianRupee, Pencil, Receipt } from 'lucide-react';
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
  const [myStructure, setMyStructure] = useState<any>(null);

  // Modal State
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [ctcInput, setCtcInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (canManage) {
        const [empRes, structRes] = await Promise.all([
          api.get('/employees', { params: { limit: 1000 } }),
          api.get('/payroll/salary-structures'),
        ]);
        setEmployees(empRes.data.data ?? []);
        setStructures(structRes.data.data ?? []);
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
        effectiveFrom: new Date().toISOString(),
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

  const renderStructureBreakdown = (struct: any) => {
    if (!struct) return <p className="text-muted-foreground text-sm">No salary structure defined yet.</p>;

    const allowances = struct.allowances || [];
    const deductions = struct.deductions || [];
    
    const totalEarnings = allowances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
    const totalDeductions = deductions.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const netPay = totalEarnings - totalDeductions;

    return (
      <div className="space-y-6">
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
        <Skeleton className="h-[400px] w-full" />
      ) : canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Salary Structures</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Employee</th>
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Monthly CTC</th>
                    <th className="text-left p-3 font-medium">Net Pay</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const struct = structures.find(s => s.employeeId === emp.id);
                    const allowances = struct?.allowances || [];
                    const deductions = struct?.deductions || [];
                    const earnings = allowances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
                    const deds = deductions.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
                    const net = struct ? earnings - deds : null;

                    return (
                      <tr key={emp.id} className="border-b">
                        <td className="p-3 font-medium">{emp.user.firstName} {emp.user.lastName}</td>
                        <td className="p-3 text-muted-foreground">{emp.employeeCode}</td>
                        <td className="p-3">
                          {struct ? `₹${Number(struct.baseSalary).toLocaleString()}` : <span className="text-muted-foreground">Not set</span>}
                        </td>
                        <td className="p-3">
                          {net !== null ? `₹${net.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-3 text-right">
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
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
            {renderStructureBreakdown(myStructure)}
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
              <p className="text-sm text-muted-foreground">
                Employee: <span className="font-medium text-foreground">{editingEmp.user.firstName} {editingEmp.user.lastName}</span>
              </p>
            )}
            <div className="space-y-2">
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
              <div className="bg-muted p-3 rounded-md text-sm space-y-2 mt-4">
                <p className="font-semibold mb-2">Preview Breakdown</p>
                {(() => {
                  const s = calculateIndianSalary(parseFloat(ctcInput));
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Basic</p>
                        <p>₹{s.allowances[0].amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">HRA</p>
                        <p>₹{s.allowances[1].amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">PF Deduction</p>
                        <p>₹{s.deductions[0].amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Net Pay</p>
                        <p className="font-bold text-primary">
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
