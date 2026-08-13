import { useEffect, useState } from 'react';
import { Wallet, Plus, PlayCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { api, getApiErrorMessage } from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';
import { SalaryStructureModal } from './components/SalaryStructureModal';
import { RunPayrollModal } from './components/RunPayrollModal';

interface PayrollRecord {
  id: string;
  month: number;
  year: number;
  baseSalary: number;
  allowances: number;
  deductions: number;
  bonus: number;
  tax: number;
  netSalary: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  unpaidLeaveDays: number;
  lateDays: number;
  payableDays: number;
  status: string;
  employee?: {
    employeeCode: string;
    user: { firstName: string; lastName: string };
  };
}

interface SalaryStructure {
  id: string;
  baseSalary: number;
  effectiveFrom: string;
  employee?: {
    employeeCode: string;
    user: { firstName: string; lastName: string };
  };
}

export function PayrollPage() {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.permissions.includes(PERMISSIONS.PAYROLL_READ) || user?.permissions.includes(PERMISSIONS.PAYROLL_WRITE);

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [currency, setCurrency] = useState('₹');
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);

  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [runPayrollModalOpen, setRunPayrollModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = api.get('/payroll', { params: { limit: 100 } });
      let s;
      if (isAdmin) {
        s = api.get('/payroll/salary-structures');
      }

      const [payrollRes, structRes] = await Promise.all([p, s]);
      const payrollData = payrollRes.data.data ?? [];
      setPayrolls(payrollData);
      setCurrency('₹');
      if (isAdmin && structRes) {
        setStructures(structRes.data.data ?? []);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadPayslip = async (id: string) => {
    setDownloadingId(id);
    try {
      const response = await api.get(`/payroll/${id}/payslip`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'] ?? '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      link.download = match?.[1] ?? `payslip-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/payroll/${id}/status`, { status });
      toast.success(`Payroll marked as ${status}`);
      fetchData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const formatCurrency = (n: number) => `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDays = (d: number) => d % 1 === 0 ? d.toString() : d.toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Payroll
          </h1>
          <p className="text-muted-foreground">Manage salary structures and monthly payroll</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStructureModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Set Structure
            </Button>
            <Button onClick={() => setRunPayrollModalOpen(true)}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Payroll
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {isAdmin && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Salary Structures</p>
                  <p className="text-2xl font-bold">{structures.length}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Payroll Records</p>
                <p className="text-2xl font-bold">{payrolls.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Net Payout</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(payrolls.reduce((sum, p) => sum + p.netSalary, 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Absences</p>
                <p className="text-2xl font-bold text-destructive">
                  {payrolls.reduce((sum, p) => sum + p.absentDays + p.unpaidLeaveDays, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {!isAdmin ? (
             <Card>
             <CardHeader><CardTitle className="text-base">My Payroll Records</CardTitle></CardHeader>
             <CardContent className="p-0">
               {payrolls.length === 0 ? (
                 <p className="p-6 text-sm text-muted-foreground">No payroll records yet.</p>
               ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-sm">
                     <thead>
                       <tr className="border-b bg-muted/50">
                         <th className="text-left p-3 font-medium">Period</th>
                         <th className="text-left p-3 font-medium">Base Salary</th>
                         <th className="text-left p-3 font-medium">Allowances</th>
                         <th className="text-left p-3 font-medium">Deductions</th>
                         <th className="text-left p-3 font-medium">Payable Days</th>
                          <th className="text-left p-3 font-medium">Net Salary</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-right p-3 font-medium">Payslip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrolls.map((p) => (
                          <tr key={p.id} className="border-b">
                           <td className="p-3">{monthNames[p.month - 1]} {p.year}</td>
                           <td className="p-3">{formatCurrency(p.baseSalary)}</td>
                           <td className="p-3">{formatCurrency(p.allowances)}</td>
                           <td className="p-3 text-destructive">-{formatCurrency(p.deductions)}</td>
                           <td className="p-3">{formatDays(p.payableDays)}/{p.workingDays}</td>
                           <td className="p-3 font-bold">{formatCurrency(p.netSalary)}</td>
                            <td className="p-3">
                              <Badge variant={p.status === 'PAID' ? 'default' : p.status === 'PROCESSED' ? 'secondary' : 'outline'}>
                                {p.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              {(p.status === 'PROCESSED' || p.status === 'PAID') && (
                                <Button size="sm" variant="ghost" disabled={downloadingId === p.id} onClick={() => handleDownloadPayslip(p.id)}>
                                  <Download className={`h-4 w-4 ${downloadingId === p.id ? 'animate-pulse' : ''}`} />
                                </Button>
                              )}
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
            <Tabs defaultValue="records" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="records">Payroll Records</TabsTrigger>
                <TabsTrigger value="structures">Salary Structures</TabsTrigger>
              </TabsList>

              <TabsContent value="records">
                <Card>
                  <CardHeader><CardTitle className="text-base">Generated Payrolls</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {payrolls.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No payroll records yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Employee</th>
                              <th className="text-left p-3 font-medium">Period</th>
                              <th className="text-left p-3 font-medium">Gross</th>
                              <th className="text-left p-3 font-medium">Days</th>
                              <th className="text-left p-3 font-medium">Absent</th>
                              <th className="text-left p-3 font-medium">Unpaid</th>
                              <th className="text-left p-3 font-medium">Net</th>
                              <th className="text-left p-3 font-medium">Status</th>
                              <th className="text-right p-3 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payrolls.map((p) => (
                              <tr key={p.id} className="border-b">
                                <td className="p-3">
                                  {p.employee
                                    ? `${p.employee.user.firstName} ${p.employee.user.lastName}`
                                    : '\u2014'}
                                </td>
                                <td className="p-3">{monthNames[p.month - 1]} {p.year}</td>
                                <td className="p-3">{formatCurrency(p.baseSalary + p.allowances)}</td>
                                <td className="p-3">
                                  <span className="cursor-help underline decoration-dotted" title={`Present: ${p.presentDays} | Absent: ${p.absentDays} | Unpaid Leave: ${p.unpaidLeaveDays} | Late: ${p.lateDays}`}>
                                    {formatDays(p.payableDays)}/{p.workingDays}
                                  </span>
                                </td>
                                <td className="p-3 text-destructive">{p.absentDays}</td>
                                <td className="p-3 text-destructive">{p.unpaidLeaveDays}</td>
                                <td className="p-3 font-bold">{formatCurrency(p.netSalary)}</td>
                                <td className="p-3">
                                  <Badge variant={p.status === 'PAID' ? 'default' : p.status === 'PROCESSED' ? 'secondary' : 'outline'}>
                                    {p.status}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right flex gap-1 justify-end">
                                  {(p.status === 'PROCESSED' || p.status === 'PAID') && (
                                    <Button size="sm" variant="ghost" disabled={downloadingId === p.id} onClick={() => handleDownloadPayslip(p.id)} title="Download Payslip">
                                      <Download className={`h-4 w-4 ${downloadingId === p.id ? 'animate-pulse' : ''}`} />
                                    </Button>
                                  )}
                                  {p.status === 'DRAFT' && (
                                    <Button size="sm" variant="outline" disabled={updatingId === p.id} onClick={() => handleUpdateStatus(p.id, 'PROCESSED')}>
                                      {updatingId === p.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                      Process
                                    </Button>
                                  )}
                                  {p.status === 'PROCESSED' && (
                                    <Button size="sm" disabled={updatingId === p.id} onClick={() => handleUpdateStatus(p.id, 'PAID')}>
                                      {updatingId === p.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                      Mark Paid
                                    </Button>
                                  )}
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

              <TabsContent value="structures">
                <Card>
                  <CardHeader><CardTitle className="text-base">Salary Structures</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {structures.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No salary structures found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Employee</th>
                              <th className="text-left p-3 font-medium">Base Salary</th>
                              <th className="text-left p-3 font-medium">Effective From</th>
                            </tr>
                          </thead>
                          <tbody>
                            {structures.map((s) => (
                              <tr key={s.id} className="border-b">
                                <td className="p-3">
                                  {s.employee
                                    ? `${s.employee.user.firstName} ${s.employee.user.lastName} (${s.employee.employeeCode})`
                                    : '\u2014'}
                                </td>
                                <td className="p-3 font-medium">{formatCurrency(s.baseSalary)}</td>
                                <td className="p-3">{new Date(s.effectiveFrom).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {isAdmin && (
        <>
          <SalaryStructureModal open={structureModalOpen} onOpenChange={setStructureModalOpen} onSuccess={fetchData} />
          <RunPayrollModal open={runPayrollModalOpen} onOpenChange={setRunPayrollModalOpen} onSuccess={fetchData} />
        </>
      )}
    </div>
  );
}
