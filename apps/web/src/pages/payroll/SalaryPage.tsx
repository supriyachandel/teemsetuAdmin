import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  IndianRupee, 
  Pencil, 
  Receipt, 
  Search, 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  Copy, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Calendar 
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks';
import { PERMISSIONS } from '@crm/shared';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export function SalaryPage() {
  const user = useAppSelector((s: any) => s.auth.user);
  const canManage = user?.permissions.includes(PERMISSIONS.PAYROLL_WRITE);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Core Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalEmployees: 0,
    monthlyPayroll: 0,
    totalBasicPay: 0,
    totalAllowances: 0,
    totalDeductions: 0,
    netSalary: 0,
  });

  // Search & Filters for Payroll
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [periodFilter, setPeriodFilter] = useState('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Selected Employee History Modal State
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [empSalaryHistory, setEmpSalaryHistory] = useState<any[]>([]);
  const [empActiveStructure, setEmpActiveStructure] = useState<any>(null);
  const [historyCache, setHistoryCache] = useState<Record<string, { history: any[]; structure: any }>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Template Form Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateBasicPay, setTemplateBasicPay] = useState('');
  const [templateAllowances, setTemplateAllowances] = useState<any[]>([]);
  const [templateDeductions, setTemplateDeductions] = useState<any[]>([]);
  const [templatePfEnabled, setTemplatePfEnabled] = useState(false);
  const [templatePfEmployeeRate, setTemplatePfEmployeeRate] = useState('12.00');
  const [templatePfEmployerRate, setTemplatePfEmployerRate] = useState('12.00');
  const [templateEsiEnabled, setTemplateEsiEnabled] = useState(false);
  const [templateEsiEmployeeRate, setTemplateEsiEmployeeRate] = useState('0.75');
  const [templateEsiEmployerRate, setTemplateEsiEmployerRate] = useState('3.25');
  const [templateTaxEnabled, setTemplateTaxEnabled] = useState(false);
  const [templateTaxCalculationType, setTemplateTaxCalculationType] = useState('PERCENTAGE');
  const [templateTaxRate, setTemplateTaxRate] = useState('0.00');

  // Assign Salary Structure Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningEmp, setAssigningEmp] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [assignBasicPay, setAssignBasicPay] = useState('');
  const [assignAllowances, setAssignAllowances] = useState<any[]>([]);
  const [assignDeductions, setAssignDeductions] = useState<any[]>([]);
  const [assignPfEnabled, setAssignPfEnabled] = useState(false);
  const [assignPfEmployeeRate, setAssignPfEmployeeRate] = useState('12.00');
  const [assignPfEmployerRate, setAssignPfEmployerRate] = useState('12.00');
  const [assignEsiEnabled, setAssignEsiEnabled] = useState(false);
  const [assignEsiEmployeeRate, setAssignEsiEmployeeRate] = useState('0.75');
  const [assignEsiEmployerRate, setAssignEsiEmployerRate] = useState('3.25');
  const [assignTaxEnabled, setAssignTaxEnabled] = useState(false);
  const [assignTaxCalculationType, setAssignTaxCalculationType] = useState('PERCENTAGE');
  const [assignTaxRate, setAssignTaxRate] = useState('0.00');
  const [effectiveFromDate, setEffectiveFromDate] = useState(new Date().toISOString().slice(0, 10));

  // Generate Payroll Modal State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      if (canManage) {
        // Fetch payroll stats
        const queryParams: any = {};
        if (periodFilter === 'THIS_MONTH') {
          queryParams.month = new Date().getMonth() + 1;
          queryParams.year = new Date().getFullYear();
        } else if (periodFilter === 'LAST_MONTH') {
          const d = new Date();
          d.setMonth(d.getMonth() - 1);
          queryParams.month = d.getMonth() + 1;
          queryParams.year = d.getFullYear();
        } else if (periodFilter === 'CUSTOM_RANGE' && customStartDate && customEndDate) {
          queryParams.startDate = customStartDate;
          queryParams.endDate = customEndDate;
        } else if (monthFilter && yearFilter) {
          queryParams.month = Number(monthFilter);
          queryParams.year = Number(yearFilter);
        }

        const [employeesRes, payrollsRes, templatesRes, statsRes] = await Promise.all([
          api.get('/employees', { params: { limit: 100 } }),
          api.get('/payroll', { params: { limit: 1000, ...queryParams } }),
          api.get('/payroll/salary-structures'),
          api.get('/payroll/stats', { params: queryParams }),
        ]);

        setEmployees(employeesRes.data.data ?? []);
        setPayrolls(payrollsRes.data.data ?? []);
        setTemplates(templatesRes.data.data ?? []);
        setStats(statsRes.data.data ?? {
          totalEmployees: 0,
          monthlyPayroll: 0,
          totalBasicPay: 0,
          totalAllowances: 0,
          totalDeductions: 0,
          netSalary: 0,
        });
      } else {
        // Employee view
        const [myStructRes, myHistoryRes] = await Promise.all([
          api.get('/payroll/salary-structures/me').catch(() => ({ data: { data: null } })),
          api.get('/payroll', { params: { limit: 100 } }),
        ]);
        setEmpActiveStructure(myStructRes.data.data);
        setEmpSalaryHistory(myHistoryRes.data.data ?? []);
      }
    } catch (e) {
      toast.error('Failed to load salary/payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canManage, periodFilter, customStartDate, customEndDate, monthFilter, yearFilter]);

  useEffect(() => {
    const handleWsEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('[WS UI] Received event on SalaryPage, triggering refetch:', customEvent.type, customEvent.detail);
      loadData();
    };

    window.addEventListener('socket:salary.updated', handleWsEvent);
    window.addEventListener('socket:payroll.generated', handleWsEvent);
    window.addEventListener('socket:payroll.updated', handleWsEvent);

    return () => {
      window.removeEventListener('socket:salary.updated', handleWsEvent);
      window.removeEventListener('socket:payroll.generated', handleWsEvent);
      window.removeEventListener('socket:payroll.updated', handleWsEvent);
    };
  }, []);

  // Calculations Helper (Frontend Preview)
  const calculatePreview = (basicStr: string, allowances: any[], deductions: any[], pfEnabled: boolean, pfEmpRate: string, esiEnabled: boolean, esiEmpRate: string, taxEnabled: boolean, taxType: string, taxRateStr: string) => {
    const basic = Number(basicStr) || 0;
    const allowancesSum = allowances.reduce((acc, a) => {
      const val = Number(a.value) || 0;
      return acc + (a.calculationType === 'PERCENTAGE' ? (basic * val / 100) : val);
    }, 0);
    const deductionsSum = deductions.reduce((acc, d) => {
      const val = Number(d.value) || 0;
      return acc + (d.calculationType === 'PERCENTAGE' ? (basic * val / 100) : val);
    }, 0);

    const pfEmployee = pfEnabled ? (basic * (Number(pfEmpRate) || 0) / 100) : 0;
    const esiEmployee = esiEnabled ? (basic * (Number(esiEmpRate) || 0) / 100) : 0;
    const tax = taxEnabled ? (taxType === 'PERCENTAGE' ? (basic * (Number(taxRateStr) || 0) / 100) : (Number(taxRateStr) || 0)) : 0;

    const gross = basic + allowancesSum;
    const net = Math.max(0, gross - deductionsSum - pfEmployee - esiEmployee - tax);

    return { gross, net, pfEmployee, esiEmployee, tax, allowancesSum, deductionsSum };
  };

  // Assign template overrides when selected template changes
  useEffect(() => {
    if (selectedTemplateId) {
      const t = templates.find(temp => temp.id === selectedTemplateId);
      if (t) {
        setAssignBasicPay(String(t.basicPay));
        setAssignAllowances(t.allowances || []);
        setAssignDeductions(t.deductions || []);
        setAssignPfEnabled(t.pfEnabled);
        setAssignPfEmployeeRate(String(t.pfEmployeeRate));
        setAssignPfEmployerRate(String(t.pfEmployerRate));
        setAssignEsiEnabled(t.esiEnabled);
        setAssignEsiEmployeeRate(String(t.esiEmployeeRate));
        setAssignEsiEmployerRate(String(t.esiEmployerRate));
        setAssignTaxEnabled(t.taxEnabled);
        setAssignTaxCalculationType(t.taxCalculationType);
        setAssignTaxRate(String(t.taxRate));
      }
    }
  }, [selectedTemplateId, templates]);

  // Save Template Action
  const handleSaveTemplate = async () => {
    if (!templateName || !templateBasicPay) {
      return toast.error('Please enter template name and basic pay');
    }
    setSavingTemplate(true);
    try {
      const payload = {
        name: templateName,
        basicPay: Number(templateBasicPay),
        allowances: templateAllowances.map(({ name, calculationType, value }) => ({ name, calculationType, value: Number(value) })),
        deductions: templateDeductions.map(({ name, calculationType, value }) => ({ name, calculationType, value: Number(value) })),
        pfEnabled: templatePfEnabled,
        pfEmployeeRate: Number(templatePfEmployeeRate) || 0,
        pfEmployerRate: Number(templatePfEmployerRate) || 0,
        esiEnabled: templateEsiEnabled,
        esiEmployeeRate: Number(templateEsiEmployeeRate) || 0,
        esiEmployerRate: Number(templateEsiEmployerRate) || 0,
        taxEnabled: templateTaxEnabled,
        taxCalculationType: templateTaxCalculationType,
        taxRate: Number(templateTaxRate) || 0,
      };

      if (editingTemplate) {
        await api.put(`/payroll/salary-structures/templates/${editingTemplate.id}`, payload);
        toast.success('Salary template updated');
      } else {
        await api.post('/payroll/salary-structures/templates', payload);
        toast.success('Salary template created');
      }
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingTemplate(false);
    }
  };

  // Duplicate Template
  const handleDuplicateTemplate = async (template: any) => {
    try {
      const payload = {
        name: `${template.name} (Copy)`,
        basicPay: Number(template.basicPay),
        allowances: template.allowances.map(({ name, calculationType, value }: any) => ({ name, calculationType, value: Number(value) })),
        deductions: template.deductions.map(({ name, calculationType, value }: any) => ({ name, calculationType, value: Number(value) })),
        pfEnabled: template.pfEnabled,
        pfEmployeeRate: Number(template.pfEmployeeRate) || 0,
        pfEmployerRate: Number(template.pfEmployerRate) || 0,
        esiEnabled: template.esiEnabled,
        esiEmployeeRate: Number(template.esiEmployeeRate) || 0,
        esiEmployerRate: Number(template.esiEmployerRate) || 0,
        taxEnabled: template.taxEnabled,
        taxCalculationType: template.taxCalculationType,
        taxRate: Number(template.taxRate) || 0,
      };
      await api.post('/payroll/salary-structures/templates', payload);
      toast.success('Salary template duplicated');
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/payroll/salary-structures/templates/${id}`);
      toast.success('Salary template deleted');
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  // Save Structure Override (Assign Salary)
  const handleSaveStructureOverride = async () => {
    if (!assigningEmp || !assignBasicPay) {
      return toast.error('Please specify basic pay for the employee');
    }
    setSavingStructure(true);
    try {
      const payload = {
        employeeId: assigningEmp.id,
        salaryStructureId: (selectedTemplateId && selectedTemplateId !== 'custom') ? selectedTemplateId : null,
        basicPay: Number(assignBasicPay),
        allowances: assignAllowances.map(({ name, calculationType, value }) => ({ name, calculationType, value: Number(value) })),
        deductions: assignDeductions.map(({ name, calculationType, value }) => ({ name, calculationType, value: Number(value) })),
        pfEnabled: assignPfEnabled,
        pfEmployeeRate: Number(assignPfEmployeeRate) || 0,
        pfEmployerRate: Number(assignPfEmployerRate) || 0,
        esiEnabled: assignEsiEnabled,
        esiEmployeeRate: Number(assignEsiEmployeeRate) || 0,
        esiEmployerRate: Number(assignEsiEmployerRate) || 0,
        taxEnabled: assignTaxEnabled,
        taxCalculationType: assignTaxCalculationType,
        taxRate: Number(assignTaxRate) || 0,
        effectiveFrom: effectiveFromDate,
      };

      await api.post('/payroll/salary-structures', payload);
      toast.success('Salary structure assigned successfully');
      setIsAssignModalOpen(false);
      setAssigningEmp(null);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingStructure(false);
    }
  };

  // Generate Payroll Action
  const handleGeneratePayroll = async () => {
    setGenerating(true);
    try {
      await api.post('/payroll/generate', { month: Number(genMonth), year: Number(genYear) });
      toast.success(`Draft payroll successfully generated for ${genMonth}/${genYear}`);
      setIsGenerateModalOpen(false);
      loadData();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  // Update Payroll Status Action
  const handleUpdatePayrollStatus = async (id: string, newStatus: 'PROCESSED' | 'PAID' | 'CANCELLED') => {
    try {
      await api.patch(`/payroll/${id}/status`, { status: newStatus });
      toast.success(`Payroll marked as ${newStatus}`);
      loadData();
      if (selectedEmp) {
        // Refresh details modal and update cache
        const historyRes = await api.get('/payroll', { params: { employeeId: selectedEmp.id, limit: 100 } });
        const history = historyRes.data.data ?? [];
        setEmpSalaryHistory(history);
        setHistoryCache(prev => ({
          ...prev,
          [selectedEmp.id]: {
            ...prev[selectedEmp.id],
            history
          }
        }));
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  // Download Payslip Action
  const handleDownloadPayslip = async (id: string) => {
    try {
      const response = await api.get(`/payroll/${id}/payslip`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to download payslip');
    }
  };

  // CSV Export Action
  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'Employee Name',
      'Month/Year',
      'Basic Pay (₹)',
      'Allowances (₹)',
      'PF Employee (₹)',
      'ESI Employee (₹)',
      'Tax (₹)',
      'Other Deductions (₹)',
      'Gross Salary (₹)',
      'Net Salary (₹)',
      'Status'
    ];

    const rows = filteredPayrolls.map(p => [
      p.employee?.employeeCode ?? '—',
      `${p.employee?.user?.firstName ?? ''} ${p.employee?.user?.lastName ?? ''}`,
      `${p.month}/${p.year}`,
      p.basicPay.toFixed(2),
      p.allowances.toFixed(2),
      p.pfEmployee.toFixed(2),
      p.esiEmployee.toFixed(2),
      p.tax.toFixed(2),
      p.otherDeductions.toFixed(2),
      p.baseSalary.toFixed(2), // Gross salary
      p.netSalary.toFixed(2),
      p.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_report_${monthFilter}_${yearFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Template Modal for Create
  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateBasicPay('');
    setTemplateAllowances([]);
    setTemplateDeductions([]);
    setTemplatePfEnabled(false);
    setTemplatePfEmployeeRate('12.00');
    setTemplatePfEmployerRate('12.00');
    setTemplateEsiEnabled(false);
    setTemplateEsiEmployeeRate('0.75');
    setTemplateEsiEmployerRate('3.25');
    setTemplateTaxEnabled(false);
    setTemplateTaxCalculationType('PERCENTAGE');
    setTemplateTaxRate('0.00');
    setIsTemplateModalOpen(true);
  };

  // Open Template Modal for Edit
  const openEditTemplateModal = (t: any) => {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateBasicPay(String(t.basicPay));
    setTemplateAllowances(t.allowances || []);
    setTemplateDeductions(t.deductions || []);
    setTemplatePfEnabled(t.pfEnabled);
    setTemplatePfEmployeeRate(String(t.pfEmployeeRate));
    setTemplatePfEmployerRate(String(t.pfEmployerRate));
    setTemplateEsiEnabled(t.esiEnabled);
    setTemplateEsiEmployeeRate(String(t.esiEmployeeRate));
    setTemplateEsiEmployerRate(String(t.esiEmployerRate));
    setTemplateTaxEnabled(t.taxEnabled);
    setTemplateTaxCalculationType(t.taxCalculationType);
    setTemplateTaxRate(String(t.taxRate));
    setIsTemplateModalOpen(true);
  };

  // Open Assign Structure Modal
  const openAssignStructureModal = async (emp: any) => {
    setAssigningEmp(emp);
    setSelectedTemplateId('');
    setAssignBasicPay('');
    setAssignAllowances([]);
    setAssignDeductions([]);
    setAssignPfEnabled(false);
    setAssignPfEmployeeRate('12.00');
    setAssignPfEmployerRate('12.00');
    setAssignEsiEnabled(false);
    setAssignEsiEmployeeRate('0.75');
    setAssignEsiEmployerRate('3.25');
    setAssignTaxEnabled(false);
    setAssignTaxCalculationType('PERCENTAGE');
    setAssignTaxRate('0.00');
    setEffectiveFromDate(new Date().toISOString().slice(0, 10));

    try {
      const res = await api.get(`/payroll/employee-salary/${emp.id}`);
      const currentSal = res.data.data;
      if (currentSal) {
        setSelectedTemplateId(currentSal.salaryStructureId || '');
        setAssignBasicPay(String(currentSal.basicPay));
        setAssignAllowances(currentSal.allowances || []);
        setAssignDeductions(currentSal.deductions || []);
        setAssignPfEnabled(currentSal.pfEnabled);
        setAssignPfEmployeeRate(String(currentSal.pfEmployeeRate));
        setAssignPfEmployerRate(String(currentSal.pfEmployerRate));
        setAssignEsiEnabled(currentSal.esiEnabled);
        setAssignEsiEmployeeRate(String(currentSal.esiEmployeeRate));
        setAssignEsiEmployerRate(String(currentSal.esiEmployerRate));
        setAssignTaxEnabled(currentSal.taxEnabled);
        setAssignTaxCalculationType(currentSal.taxCalculationType);
        setAssignTaxRate(String(currentSal.taxRate));
        setEffectiveFromDate(currentSal.effectiveFrom);
      }
    } catch (e) {
      // Ignore fallback
    }
    setIsAssignModalOpen(true);
  };

  // Open History Details Modal
  const openHistoryDetailsModal = async (emp: any) => {
    setSelectedEmp(emp);
    
    // Check cache
    if (historyCache[emp.id]) {
      setEmpSalaryHistory(historyCache[emp.id].history);
      setEmpActiveStructure(historyCache[emp.id].structure);
      setLoadingHistory(false);
      return;
    }

    setEmpSalaryHistory([]);
    setEmpActiveStructure(null);
    setLoadingHistory(true);
    try {
      const [historyRes, structureRes] = await Promise.all([
        api.get('/payroll', { params: { employeeId: emp.id, limit: 100 } }),
        api.get(`/payroll/employee-salary/${emp.id}`).catch(() => ({ data: { data: null } })),
      ]);
      const history = historyRes.data.data ?? [];
      const structure = structureRes.data.data;
      setEmpSalaryHistory(history);
      setEmpActiveStructure(structure);
      // Cache results
      setHistoryCache(prev => ({
        ...prev,
        [emp.id]: { history, structure }
      }));
    } catch (e) {
      toast.error('Failed to load employee details');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtered Payrolls
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter(p => {
      const empName = `${p.employee?.user?.firstName ?? ''} ${p.employee?.user?.lastName ?? ''}`.toLowerCase();
      const code = (p.employee?.employeeCode ?? '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return empName.includes(search) || code.includes(search);
    });
  }, [payrolls, searchTerm]);

  // Chart Data Preparation (last 6 months chronological)
  const chartData = useMemo(() => {
    return [...empSalaryHistory]
      .filter(p => p.status === 'PAID' || p.status === 'PROCESSED')
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .slice(-6)
      .map(p => ({
        name: new Date(p.year, p.month - 1).toLocaleString('en-US', { month: 'short' }),
        netSalary: p.netSalary,
        allowances: p.allowances,
        deductions: p.deductions,
      }));
  }, [empSalaryHistory]);

  // Form List Modifiers
  const addAllowance = (type: 'template' | 'assign') => {
    const item = { name: '', calculationType: 'FIXED', value: '0' };
    if (type === 'template') {
      setTemplateAllowances([...templateAllowances, item]);
    } else {
      setAssignAllowances([...assignAllowances, item]);
    }
  };

  const removeAllowance = (type: 'template' | 'assign', index: number) => {
    if (type === 'template') {
      setTemplateAllowances(templateAllowances.filter((_, i) => i !== index));
    } else {
      setAssignAllowances(assignAllowances.filter((_, i) => i !== index));
    }
  };

  const updateAllowance = (type: 'template' | 'assign', index: number, field: string, val: string) => {
    const list = type === 'template' ? [...templateAllowances] : [...assignAllowances];
    list[index] = { ...list[index], [field]: val };
    if (type === 'template') {
      setTemplateAllowances(list);
    } else {
      setAssignAllowances(list);
    }
  };

  const addDeduction = (type: 'template' | 'assign') => {
    const item = { name: '', calculationType: 'FIXED', value: '0' };
    if (type === 'template') {
      setTemplateDeductions([...templateDeductions, item]);
    } else {
      setAssignDeductions([...assignDeductions, item]);
    }
  };

  const removeDeduction = (type: 'template' | 'assign', index: number) => {
    if (type === 'template') {
      setTemplateDeductions(templateDeductions.filter((_, i) => i !== index));
    } else {
      setAssignDeductions(assignDeductions.filter((_, i) => i !== index));
    }
  };

  const updateDeduction = (type: 'template' | 'assign', index: number, field: string, val: string) => {
    const list = type === 'template' ? [...templateDeductions] : [...assignDeductions];
    list[index] = { ...list[index], [field]: val };
    if (type === 'template') {
      setTemplateDeductions(list);
    } else {
      setAssignDeductions(list);
    }
  };

  // Preview computations
  const templatePreview = calculatePreview(
    templateBasicPay,
    templateAllowances,
    templateDeductions,
    templatePfEnabled,
    templatePfEmployeeRate,
    templateEsiEnabled,
    templateEsiEmployeeRate,
    templateTaxEnabled,
    templateTaxCalculationType,
    templateTaxRate
  );

  const assignPreview = calculatePreview(
    assignBasicPay,
    assignAllowances,
    assignDeductions,
    assignPfEnabled,
    assignPfEmployeeRate,
    assignEsiEnabled,
    assignEsiEmployeeRate,
    assignTaxEnabled,
    assignTaxCalculationType,
    assignTaxRate
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <IndianRupee className="h-7 w-7 text-primary" />
            Salary & Payroll Management
          </h1>
          <p className="text-muted-foreground mt-1">
            {canManage 
              ? 'Configure salary templates, overrides, and compute monthly payroll budgets.' 
              : 'View your personal salary structures and monthly payslips.'}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsGenerateModalOpen(true)}>
              <Calendar className="mr-2 h-4 w-4" />
              Generate Monthly Payroll
            </Button>
            <Button onClick={openCreateTemplateModal}>
              <Plus className="mr-2 h-4 w-4" />
              New Structure Template
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-[450px] w-full" />
        </div>
      ) : canManage ? (
        <Tabs defaultValue="payroll" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="payroll">Payroll Records & Reports</TabsTrigger>
            <TabsTrigger value="structures">Employee Salary Configurations</TabsTrigger>
            <TabsTrigger value="templates">Salary Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="payroll" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                  <p className="text-xs text-muted-foreground">Active head count</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Payroll Budget</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{stats.monthlyPayroll.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Net take-home salary sum</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Basic Pay</CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{stats.totalBasicPay.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Accumulated basic salary</p>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Allowances</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{stats.totalAllowances.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">All special allowances and bonuses</p>
                </CardContent>
              </Card>
            </div>

            {/* Payroll Search & Filters */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                  <CardTitle className="text-base font-semibold">Interactive Monthly Payroll Table</CardTitle>
                  <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search employee or code..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <Select value={periodFilter} onValueChange={setPeriodFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="THIS_MONTH">This Month</SelectItem>
                        <SelectItem value="LAST_MONTH">Last Month</SelectItem>
                        <SelectItem value="ALL_TIME">Select Month/Year</SelectItem>
                        <SelectItem value="CUSTOM_RANGE">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>

                    {periodFilter === 'ALL_TIME' && (
                      <div className="flex gap-2">
                        <Select value={monthFilter} onValueChange={setMonthFilter}>
                          <SelectTrigger className="w-[110px]">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }).map((_, i) => (
                              <SelectItem key={i} value={String(i + 1)}>
                                {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={yearFilter} onValueChange={setYearFilter}>
                          <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }).map((_, i) => {
                              const y = new Date().getFullYear() - i;
                              return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {periodFilter === 'CUSTOM_RANGE' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          className="w-[140px]"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                        <span className="text-muted-foreground text-xs">to</span>
                        <Input
                          type="date"
                          className="w-[140px]"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                      </div>
                    )}

                    <Button variant="outline" onClick={handleExportCSV}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-4 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Period</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Basic Pay</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Allowances</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">PF (Emp)</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">ESI (Emp)</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Tax</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Other Deds</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Gross</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayrolls.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-muted/10 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-foreground">
                              {p.employee?.user?.firstName ?? ''} {p.employee?.user?.lastName ?? ''}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.employee?.employeeCode ?? '—'}</div>
                          </td>
                          <td className="p-4">
                            {new Date(p.year, p.month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 text-right font-medium">₹{p.basicPay.toLocaleString()}</td>
                          <td className="p-4 text-right text-green-500">₹{p.allowances.toLocaleString()}</td>
                          <td className="p-4 text-right text-red-400">₹{p.pfEmployee.toLocaleString()}</td>
                          <td className="p-4 text-right text-red-400">₹{p.esiEmployee.toLocaleString()}</td>
                          <td className="p-4 text-right text-red-400">₹{p.tax.toLocaleString()}</td>
                          <td className="p-4 text-right text-red-400">₹{p.otherDeductions.toLocaleString()}</td>
                          <td className="p-4 text-right font-medium">₹{p.baseSalary.toLocaleString()}</td>
                          <td className="p-4 text-right font-bold text-green-400">₹{p.netSalary.toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <Badge variant={p.status === 'PAID' ? 'default' : p.status === 'PROCESSED' ? 'secondary' : 'outline'}>
                              {p.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openHistoryDetailsModal(p.employee)}>
                              History
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDownloadPayslip(p.id)} title="Download payslip">
                              <Download className="h-4 w-4" />
                            </Button>
                            {p.status === 'DRAFT' && (
                              <Button size="icon" variant="ghost" className="text-green-500" onClick={() => handleUpdatePayrollStatus(p.id, 'PROCESSED')} title="Process">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {p.status === 'PROCESSED' && (
                              <Button size="icon" variant="ghost" className="text-green-400" onClick={() => handleUpdatePayrollStatus(p.id, 'PAID')} title="Mark Paid">
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredPayrolls.length === 0 && (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-muted-foreground">
                            No payroll records found matching selected filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structures" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Assign Employee Salary Structures</CardTitle>
                <CardDescription>Configure basic pay, customized allowances, deductions, PF, and Tax rules per employee.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-4 font-medium text-muted-foreground">Employee</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Department / Role</th>
                        <th className="text-left p-4 font-medium text-muted-foreground">Config Type</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Basic Pay</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">PF Settings</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">ESI Settings</th>
                        <th className="text-center p-4 font-medium text-muted-foreground">Tax Settings</th>
                        <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className="border-b hover:bg-muted/10 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-foreground">
                              {emp.user.firstName} {emp.user.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{emp.employeeCode || '—'}</div>
                          </td>
                          <td className="p-4">
                            <div>{emp.department?.name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{emp.designation?.title || ''}</div>
                          </td>
                          <td className="p-4">
                            {emp.employeeSalary?.salaryStructure?.isTemplate ? (
                              <Badge variant="secondary">Template ({emp.employeeSalary.salaryStructure.name})</Badge>
                            ) : emp.employeeSalary ? (
                              <Badge variant="outline">Custom Override</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10">Not Set</Badge>
                            )}
                          </td>
                          <td className="p-4 text-right font-medium">
                            {emp.employeeSalary 
                              ? `₹${Number(emp.employeeSalary.basicPay).toLocaleString()}` 
                              : '—'}
                          </td>
                          <td className="p-4 text-center">
                            {emp.employeeSalary?.salaryStructure?.pfEnabled ? (
                              <Badge className="bg-green-600/20 text-green-500 hover:bg-green-600/20 border-green-700">
                                {Number(emp.employeeSalary.salaryStructure.pfEmployeeRate)}% Emp
                              </Badge>
                            ) : 'Disabled'}
                          </td>
                          <td className="p-4 text-center">
                            {emp.employeeSalary?.salaryStructure?.esiEnabled ? (
                              <Badge className="bg-green-600/20 text-green-500 hover:bg-green-600/20 border-green-700">
                                {Number(emp.employeeSalary.salaryStructure.esiEmployeeRate)}% Emp
                              </Badge>
                            ) : 'Disabled'}
                          </td>
                          <td className="p-4 text-center">
                            {emp.employeeSalary?.salaryStructure?.taxEnabled ? (
                              <Badge className="bg-red-600/20 text-red-500 hover:bg-red-600/20 border-red-700">
                                {emp.employeeSalary.salaryStructure.taxCalculationType === 'PERCENTAGE' 
                                  ? `${Number(emp.employeeSalary.salaryStructure.taxRate)}%` 
                                  : `₹${Number(emp.employeeSalary.salaryStructure.taxRate)}`}
                              </Badge>
                            ) : 'Disabled'}
                          </td>
                          <td className="p-4 text-right">
                            <Button size="sm" variant="outline" onClick={() => openAssignStructureModal(emp)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Configure Salary
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => {
                const preview = calculatePreview(
                  String(t.basicPay),
                  t.allowances || [],
                  t.deductions || [],
                  t.pfEnabled,
                  String(t.pfEmployeeRate),
                  t.esiEnabled,
                  String(t.esiEmployeeRate),
                  t.taxEnabled,
                  t.taxCalculationType,
                  String(t.taxRate)
                );

                return (
                  <Card key={t.id} className="flex flex-col justify-between bg-card/40">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-bold">{t.name}</CardTitle>
                          <CardDescription>Base salary configuration template</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Template
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm pb-6">
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Basic Pay:</span>
                        <span className="font-semibold">₹{t.basicPay.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Allowances:</span>
                        <span className="font-semibold text-green-500">₹{preview.allowancesSum.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">PF Contribution (Employee):</span>
                        <span className="font-semibold text-red-400">
                          {t.pfEnabled ? `₹${preview.pfEmployee.toLocaleString()} (${t.pfEmployeeRate}%)` : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">ESI Contribution (Employee):</span>
                        <span className="font-semibold text-red-400">
                          {t.esiEnabled ? `₹${preview.esiEmployee.toLocaleString()} (${t.esiEmployeeRate}%)` : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground">Tax Deduction:</span>
                        <span className="font-semibold text-red-400">
                          {t.taxEnabled 
                            ? `₹${preview.tax.toLocaleString()} (${t.taxCalculationType === 'PERCENTAGE' ? `${t.taxRate}%` : 'Fixed'})` 
                            : 'Disabled'}
                        </span>
                      </div>
                      <div className="bg-muted/50 p-3 rounded flex justify-between items-center font-bold text-base mt-2">
                        <span>Net Take-Home Pay:</span>
                        <span className="text-green-400">₹{preview.net.toLocaleString()}</span>
                      </div>
                    </CardContent>
                    <DialogFooter className="px-6 pb-6 pt-0 border-t flex items-center justify-between gap-2 mt-auto">
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicateTemplate(t)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-400" onClick={() => handleDeleteTemplate(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditTemplateModal(t)}>
                          Edit Structure
                        </Button>
                      </div>
                    </DialogFooter>
                  </Card>
                );
              })}
              {templates.length === 0 && (
                <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg bg-card/25">
                  No templates created. Click "New Structure Template" to create one.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        /* Employee-only personal salary page view */
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1 bg-card/50">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">My Salary Structure</CardTitle>
              </div>
              <CardDescription>Current configured salary structure details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {empActiveStructure ? (
                <div className="space-y-4">
                  <div className="flex justify-between border-b pb-2 text-sm">
                    <span className="text-muted-foreground">Basic Pay</span>
                    <span className="font-semibold">₹{empActiveStructure.basicPay.toLocaleString()}</span>
                  </div>
                  {empActiveStructure.allowances?.map((a: any) => (
                    <div key={a.id} className="flex justify-between border-b pb-2 text-sm">
                      <span className="text-muted-foreground">{a.name} ({a.calculationType === 'PERCENTAGE' ? `${a.value}%` : 'Fixed'})</span>
                      <span className="font-semibold text-green-500">
                        ₹{(a.calculationType === 'PERCENTAGE' ? (empActiveStructure.basicPay * a.value / 100) : a.value).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-b pb-2 text-sm">
                    <span className="text-muted-foreground">PF Contribution (Employee)</span>
                    <span className="font-semibold text-red-400">
                      {empActiveStructure.pfEnabled 
                        ? `₹${(empActiveStructure.basicPay * empActiveStructure.pfEmployeeRate / 100).toLocaleString()} (${empActiveStructure.pfEmployeeRate}%)` 
                        : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2 text-sm">
                    <span className="text-muted-foreground">ESI Contribution (Employee)</span>
                    <span className="font-semibold text-red-400">
                      {empActiveStructure.esiEnabled 
                        ? `₹${(empActiveStructure.basicPay * empActiveStructure.esiEmployeeRate / 100).toLocaleString()} (${empActiveStructure.esiEmployeeRate}%)` 
                        : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2 text-sm">
                    <span className="text-muted-foreground">Tax Deductions</span>
                    <span className="font-semibold text-red-400">
                      {empActiveStructure.taxEnabled 
                        ? `₹${(empActiveStructure.taxCalculationType === 'PERCENTAGE' ? (empActiveStructure.basicPay * empActiveStructure.taxRate / 100) : empActiveStructure.taxRate).toLocaleString()}` 
                        : 'Disabled'}
                    </span>
                  </div>
                  <div className="bg-muted p-4 rounded-md text-center mt-6">
                    <p className="text-xs text-muted-foreground">Estimated Net take-home Pay</p>
                    <p className="text-3xl font-extrabold text-green-400 mt-1">₹{empActiveStructure.netSalary.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6">Your salary structure has not been set yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-card/50">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg">Salary History & Payslips</CardTitle>
              <CardDescription>Track monthly earnings, payouts, and download payslips.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-4 font-medium text-muted-foreground">Period</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Gross</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Deductions</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Tax</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Net Payout</th>
                      <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empSalaryHistory.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-muted/10">
                        <td className="p-4 font-semibold">
                          {new Date(p.year, p.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="p-4 text-right">₹{p.baseSalary.toLocaleString()}</td>
                        <td className="p-4 text-right text-red-400">₹{p.deductions.toLocaleString()}</td>
                        <td className="p-4 text-right text-red-400">₹{p.tax.toLocaleString()}</td>
                        <td className="p-4 text-right text-green-400 font-bold">₹{p.netSalary.toLocaleString()}</td>
                        <td className="p-4 text-center">
                          <Badge variant={p.status === 'PAID' ? 'default' : 'outline'}>{p.status}</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button size="icon" variant="ghost" onClick={() => handleDownloadPayslip(p.id)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {empSalaryHistory.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No payslips generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Salary Template Creation & Editing Dialog */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Salary Template' : 'Create Salary Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. Senior Software Engineer Grade 1"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Basic Pay (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={templateBasicPay}
                onChange={(e) => setTemplateBasicPay(e.target.value)}
              />
            </div>

            {/* PF Card Section */}
            <Card className="p-4 bg-muted/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Provident Fund (PF) Settings</Label>
                  <p className="text-xs text-muted-foreground">Enable Employee & Employer PF contributions calculated on Basic Pay.</p>
                </div>
                <Input
                  type="checkbox"
                  className="w-5 h-5 rounded cursor-pointer"
                  checked={templatePfEnabled}
                  onChange={(e) => setTemplatePfEnabled(e.target.checked)}
                />
              </div>

              {templatePfEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Employee PF Rate (%)</Label>
                    <Input
                      type="number"
                      value={templatePfEmployeeRate}
                      onChange={(e) => setTemplatePfEmployeeRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Employer PF Rate (%)</Label>
                    <Input
                      type="number"
                      value={templatePfEmployerRate}
                      onChange={(e) => setTemplatePfEmployerRate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* ESI Card Section */}
            <Card className="p-4 bg-muted/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Employee State Insurance (ESI) Settings</Label>
                  <p className="text-xs text-muted-foreground">Enable health insurance deduction calculated on Basic Pay.</p>
                </div>
                <Input
                  type="checkbox"
                  className="w-5 h-5 rounded cursor-pointer"
                  checked={templateEsiEnabled}
                  onChange={(e) => setTemplateEsiEnabled(e.target.checked)}
                />
              </div>

              {templateEsiEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Employee ESI Rate (%)</Label>
                    <Input
                      type="number"
                      value={templateEsiEmployeeRate}
                      onChange={(e) => setTemplateEsiEmployeeRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Employer ESI Rate (%)</Label>
                    <Input
                      type="number"
                      value={templateEsiEmployerRate}
                      onChange={(e) => setTemplateEsiEmployerRate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Tax / TDS Settings */}
            <Card className="p-4 bg-muted/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Income Tax / TDS Settings</Label>
                  <p className="text-xs text-muted-foreground">Configure monthly tax deductions (Percentage or Fixed amount).</p>
                </div>
                <Input
                  type="checkbox"
                  className="w-5 h-5 rounded cursor-pointer"
                  checked={templateTaxEnabled}
                  onChange={(e) => setTemplateTaxEnabled(e.target.checked)}
                />
              </div>

              {templateTaxEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Tax Calculation Type</Label>
                    <Select value={templateTaxCalculationType} onValueChange={setTemplateTaxCalculationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percentage of Basic (%)</SelectItem>
                        <SelectItem value="FIXED">Fixed Monthly Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tax Rate / Amount</Label>
                    <Input
                      type="number"
                      value={templateTaxRate}
                      onChange={(e) => setTemplateTaxRate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Allowances list */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Earnings / Allowances</Label>
                <Button size="sm" variant="outline" onClick={() => addAllowance('template')}>
                  <Plus className="h-4 w-4 mr-1" /> Add Allowance
                </Button>
              </div>

              {templateAllowances.map((a, i) => (
                <div key={i} className="flex gap-3 items-center border p-3 rounded-md bg-muted/20">
                  <Input
                    placeholder="Allowance Name"
                    className="flex-2"
                    value={a.name}
                    onChange={(e) => updateAllowance('template', i, 'name', e.target.value)}
                  />
                  <Select value={a.calculationType} onValueChange={(val) => updateAllowance('template', i, 'calculationType', val)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">% of Basic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-[100px]"
                    placeholder="Value"
                    value={a.value}
                    onChange={(e) => updateAllowance('template', i, 'value', e.target.value)}
                  />
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeAllowance('template', i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Deductions List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Other Deductions</Label>
                <Button size="sm" variant="outline" onClick={() => addDeduction('template')}>
                  <Plus className="h-4 w-4 mr-1" /> Add Deduction
                </Button>
              </div>

              {templateDeductions.map((d, i) => (
                <div key={i} className="flex gap-3 items-center border p-3 rounded-md bg-muted/20">
                  <Input
                    placeholder="Deduction Name"
                    className="flex-2"
                    value={d.name}
                    onChange={(e) => updateDeduction('template', i, 'name', e.target.value)}
                  />
                  <Select value={d.calculationType} onValueChange={(val) => updateDeduction('template', i, 'calculationType', val)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">% of Basic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-[100px]"
                    placeholder="Value"
                    value={d.value}
                    onChange={(e) => updateDeduction('template', i, 'value', e.target.value)}
                  />
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeDeduction('template', i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Calculation Preview */}
            <div className="bg-muted p-4 rounded-lg space-y-3 border">
              <p className="font-bold border-b pb-2 text-sm">Calculated Live Structure Preview</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Basic Pay:</p>
                  <p className="font-medium text-sm">₹{(Number(templateBasicPay) || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gross Earnings:</p>
                  <p className="font-medium text-sm text-green-500">₹{templatePreview.gross.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Deductions:</p>
                  <p className="font-medium text-sm text-red-400">
                    ₹{(templatePreview.deductionsSum + templatePreview.pfEmployee + templatePreview.esiEmployee + templatePreview.tax).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Payout:</p>
                  <p className="font-bold text-base text-green-400">₹{templatePreview.net.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Salary Structure Override Dialog */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-2xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Employee Salary structure</DialogTitle>
            {assigningEmp && (
              <CardDescription className="text-sm font-medium mt-1">
                Configure structure details for {assigningEmp.user.firstName} {assigningEmp.user.lastName} ({assigningEmp.employeeCode})
              </CardDescription>
            )}
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>Select Base Template (Optional)</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a salary structure template to copy settings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">No Template / Custom Configuration</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} (Basic: ₹{t.basicPay.toLocaleString()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Basic Pay (₹)</Label>
              <Input
                type="number"
                placeholder="Basic Pay salary amount"
                value={assignBasicPay}
                onChange={(e) => setAssignBasicPay(e.target.value)}
              />
            </div>

            {/* PF Overrides */}
            <Card className="p-4 bg-muted/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Enable Provident Fund (PF)</Label>
                  <p className="text-xs text-muted-foreground">Calculate employee & employer PF contributions.</p>
                </div>
                <Input
                  type="checkbox"
                  className="w-5 h-5 rounded cursor-pointer"
                  checked={assignPfEnabled}
                  onChange={(e) => setAssignPfEnabled(e.target.checked)}
                />
              </div>

              {assignPfEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Employee PF Rate (%)</Label>
                    <Input
                      type="number"
                      value={assignPfEmployeeRate}
                      onChange={(e) => setAssignPfEmployeeRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Employer PF Rate (%)</Label>
                    <Input
                      type="number"
                      value={assignPfEmployerRate}
                      onChange={(e) => setAssignPfEmployerRate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* ESI Overrides */}
            <Card className="p-4 bg-muted/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Enable Employee State Insurance (ESI)</Label>
                  <p className="text-xs text-muted-foreground">Calculate ESI health scheme contributions.</p>
                </div>
                <Input
                  type="checkbox"
                  className="w-5 h-5 rounded cursor-pointer"
                  checked={assignEsiEnabled}
                  onChange={(e) => setAssignEsiEnabled(e.target.checked)}
                />
              </div>

              {assignEsiEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Employee ESI Rate (%)</Label>
                    <Input
                      type="number"
                      value={assignEsiEmployeeRate}
                      onChange={(e) => setAssignEsiEmployeeRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Employer ESI Rate (%)</Label>
                    <Input
                      type="number"
                      value={assignEsiEmployerRate}
                      onChange={(e) => setAssignEsiEmployerRate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Tax Settings */}
            <Card className="p-4 bg-muted/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Income Tax / TDS Settings</Label>
                  <p className="text-xs text-muted-foreground">Calculate TDS deduction for the employee.</p>
                </div>
                <Input
                  type="checkbox"
                  className="w-5 h-5 rounded cursor-pointer"
                  checked={assignTaxEnabled}
                  onChange={(e) => setAssignTaxEnabled(e.target.checked)}
                />
              </div>

              {assignTaxEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Tax Calculation Type</Label>
                    <Select value={assignTaxCalculationType} onValueChange={setAssignTaxCalculationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percentage of Basic (%)</SelectItem>
                        <SelectItem value="FIXED">Fixed Monthly Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tax Rate / Amount</Label>
                    <Input
                      type="number"
                      value={assignTaxRate}
                      onChange={(e) => setAssignTaxRate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Allowances list */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Earnings / Allowances</Label>
                <Button size="sm" variant="outline" onClick={() => addAllowance('assign')}>
                  <Plus className="h-4 w-4 mr-1" /> Add Allowance
                </Button>
              </div>

              {assignAllowances.map((a, i) => (
                <div key={i} className="flex gap-3 items-center border p-3 rounded-md bg-muted/20">
                  <Input
                    placeholder="Allowance Name"
                    className="flex-2"
                    value={a.name}
                    onChange={(e) => updateAllowance('assign', i, 'name', e.target.value)}
                  />
                  <Select value={a.calculationType} onValueChange={(val) => updateAllowance('assign', i, 'calculationType', val)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">% of Basic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-[100px]"
                    placeholder="Value"
                    value={a.value}
                    onChange={(e) => updateAllowance('assign', i, 'value', e.target.value)}
                  />
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeAllowance('assign', i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Deductions List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Other Deductions</Label>
                <Button size="sm" variant="outline" onClick={() => addDeduction('assign')}>
                  <Plus className="h-4 w-4 mr-1" /> Add Deduction
                </Button>
              </div>

              {assignDeductions.map((d, i) => (
                <div key={i} className="flex gap-3 items-center border p-3 rounded-md bg-muted/20">
                  <Input
                    placeholder="Deduction Name"
                    className="flex-2"
                    value={d.name}
                    onChange={(e) => updateDeduction('assign', i, 'name', e.target.value)}
                  />
                  <Select value={d.calculationType} onValueChange={(val) => updateDeduction('assign', i, 'calculationType', val)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Fixed (₹)</SelectItem>
                      <SelectItem value="PERCENTAGE">% of Basic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    className="w-[100px]"
                    placeholder="Value"
                    value={d.value}
                    onChange={(e) => updateDeduction('assign', i, 'value', e.target.value)}
                  />
                  <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeDeduction('assign', i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveFromDate}
                onChange={(e) => setEffectiveFromDate(e.target.value)}
              />
            </div>

            {/* Calculation Preview */}
            <div className="bg-muted p-4 rounded-lg space-y-3 border">
              <p className="font-bold border-b pb-2 text-sm">Calculated Live Structure Preview</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Basic Pay:</p>
                  <p className="font-medium text-sm">₹{(Number(assignBasicPay) || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gross Earnings:</p>
                  <p className="font-medium text-sm text-green-500">₹{assignPreview.gross.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Deductions:</p>
                  <p className="font-medium text-sm text-red-400">
                    ₹{(assignPreview.deductionsSum + assignPreview.pfEmployee + assignPreview.esiEmployee + assignPreview.tax).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Payout:</p>
                  <p className="font-bold text-base text-green-400">₹{assignPreview.net.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStructureOverride} disabled={savingStructure}>
              {savingStructure ? 'Assigning...' : 'Assign Structure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Payroll Dialog */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Generate Monthly Payroll</DialogTitle>
            <CardDescription>This creates draft payroll records for all active employees with defined salary structures.</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {new Date(2000, i).toLocaleString('en-US', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={genYear} onValueChange={setGenYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const y = new Date().getFullYear() - i;
                      return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleGeneratePayroll} disabled={generating}>
              {generating ? 'Generating...' : 'Confirm & Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Employee History & Chart Dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={(open) => !open && setSelectedEmp(null)}>
        <DialogContent className="max-w-4xl bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Employee Salary Summary & History
            </DialogTitle>
            {selectedEmp && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">
                  Detailed salary overview and past 6-month trend for {selectedEmp.user?.firstName} {selectedEmp.user?.lastName} ({selectedEmp.employeeCode})
                </span>
                {selectedEmp.employmentStatus && (
                  <Badge className={selectedEmp.employmentStatus === 'ACTIVE' ? "bg-green-600/20 text-green-500 hover:bg-green-600/20 border-green-700" : "bg-red-600/20 text-red-500 hover:bg-red-600/20 border-red-700"}>
                    {selectedEmp.employmentStatus}
                  </Badge>
                )}
              </div>
            )}
          </DialogHeader>

          {selectedEmp && (
            <div className="space-y-6 py-4">
              {loadingHistory ? (
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-[250px] w-full" />
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-[200px] w-full" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Top Trend Chart & Structure */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* 6-Month Salary Trend Chart */}
                    <Card className="bg-card/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          Net Salary Trend (Last 6 Months)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="h-[200px]">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                              <YAxis stroke="#9ca3af" fontSize={11} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '6px' }}
                                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                              />
                              <Area type="monotone" dataKey="netSalary" name="Net Salary" stroke="#22c55e" fillOpacity={1} fill="url(#colorNet)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-1 border border-dashed rounded-md bg-card/10">
                            <AlertCircle className="h-6 w-6" />
                            No paid/processed payroll history in last 6 months.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Current Active Structure Card */}
                    <Card className="bg-card/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-primary" />
                          Active Salary Structure
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-2">
                        {empActiveStructure ? (
                          <>
                            <div className="flex justify-between border-b pb-1">
                              <span className="text-muted-foreground">Basic Pay:</span>
                              <span className="font-semibold">₹{empActiveStructure.basicPay.toLocaleString()}</span>
                            </div>
                            {empActiveStructure.allowances?.map((a: any) => (
                              <div key={a.id} className="flex justify-between border-b pb-1">
                                <span className="text-muted-foreground">{a.name}:</span>
                                <span className="font-semibold text-green-500">
                                  ₹{(a.calculationType === 'PERCENTAGE' ? (empActiveStructure.basicPay * a.value / 100) : a.value).toLocaleString()}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between border-b pb-1">
                              <span className="text-muted-foreground">PF (Employee):</span>
                              <span className="font-semibold text-red-400">
                                {empActiveStructure.pfEnabled ? `₹${(empActiveStructure.basicPay * empActiveStructure.pfEmployeeRate / 100).toLocaleString()}` : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex justify-between border-b pb-1">
                              <span className="text-muted-foreground">ESI (Employee):</span>
                              <span className="font-semibold text-red-400">
                                {empActiveStructure.esiEnabled ? `₹${(empActiveStructure.basicPay * empActiveStructure.esiEmployeeRate / 100).toLocaleString()}` : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex justify-between border-b pb-1">
                              <span className="text-muted-foreground">Tax Deductions:</span>
                              <span className="font-semibold text-red-400">
                                {empActiveStructure.taxEnabled ? `₹${(empActiveStructure.taxCalculationType === 'PERCENTAGE' ? (empActiveStructure.basicPay * empActiveStructure.taxRate / 100) : empActiveStructure.taxRate).toLocaleString()}` : 'Disabled'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center font-bold text-sm bg-muted p-2 rounded mt-3">
                              <span>Est. Net Payout:</span>
                              <span className="text-green-400">₹{empActiveStructure.netSalary.toLocaleString()}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[140px] text-muted-foreground text-xs gap-1 border border-dashed rounded-md bg-card/10">
                            <AlertCircle className="h-6 w-6" />
                            No active structure set for this employee.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Salary History Table */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Monthly Payroll History</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="p-3 font-medium text-muted-foreground">Period</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Basic Pay</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Gross Pay</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">PF (Emp)</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">ESI (Emp)</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Tax</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Other Deds</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Net Payout</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">Status</th>
                            <th className="p-3 font-medium text-muted-foreground text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empSalaryHistory.map((h) => (
                            <tr key={h.id} className="border-b hover:bg-muted/10">
                              <td className="p-3 font-semibold">
                                {new Date(h.year, h.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                              </td>
                              <td className="p-3 text-right">₹{h.basicPay.toLocaleString()}</td>
                              <td className="p-3 text-right">₹{h.baseSalary.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-400">₹{h.pfEmployee.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-400">₹{h.esiEmployee.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-400">₹{h.tax.toLocaleString()}</td>
                              <td className="p-3 text-right text-red-400">₹{h.otherDeductions.toLocaleString()}</td>
                              <td className="p-3 text-right text-green-400 font-bold">₹{h.netSalary.toLocaleString()}</td>
                              <td className="p-3 text-center">
                                <Badge variant={h.status === 'PAID' ? 'default' : 'outline'}>{h.status}</Badge>
                              </td>
                              <td className="p-3 text-right flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handleDownloadPayslip(h.id)} title="Download payslip">
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                {h.status === 'DRAFT' && (
                                  <Button size="sm" variant="outline" className="h-7 text-green-500 border-green-700/50" onClick={() => handleUpdatePayrollStatus(h.id, 'PROCESSED')}>
                                    Process
                                  </Button>
                                )}
                                {h.status === 'PROCESSED' && (
                                  <Button size="sm" variant="outline" className="h-7 text-green-400 border-green-600/50" onClick={() => handleUpdatePayrollStatus(h.id, 'PAID')}>
                                    Mark Paid
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {empSalaryHistory.length === 0 && (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-muted-foreground">
                                No payroll history generated for this employee.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setSelectedEmp(null)}>Close Summary</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
