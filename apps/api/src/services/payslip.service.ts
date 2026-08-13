import PDFDocument from 'pdfkit';
import { prisma } from '../config/database';
import { NotFoundError } from '../utils/errors';
import https from 'https';
import http from 'http';

function fmt(val: number | string | { toString(): string }, decimals = 2): string {
  return Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fetchImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    if (!url.startsWith('http')) return resolve(null);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      const data: Buffer[] = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', () => resolve(null));
  });
}

export class PayslipService {
  async generatePayslip(companyId: string, payrollId: string): Promise<Buffer> {
    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!payroll || payroll.employee.companyId !== companyId) {
      throw new NotFoundError('Payroll record not found');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, currency: true, logoUrl: true, website: true },
    });

    const currency = company?.currency === 'INR' ? '\u20B9' : '$';
    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const salaryStructure = await prisma.salaryStructure.findUnique({
      where: { employeeId: payroll.employeeId },
    });

    const allowanceItems = (salaryStructure?.allowances as Array<{ label: string; amount: number }>) ?? [];
    const deductionItems = (salaryStructure?.deductions as Array<{ label: string; amount: number }>) ?? [];

    const pageWidth = doc.page.width - 80;
    const leftCol = 40;
    
    // ── Header (Logo + Company Name) ──
    let startY = 40;
    if (company?.logoUrl) {
      const imgBuffer = await fetchImage(company.logoUrl);
      if (imgBuffer) {
        try {
          doc.image(imgBuffer, leftCol, startY, { fit: [100, 50] });
          startY += 60;
        } catch (e) {
          // ignore image errors
        }
      }
    }
    
    doc.fontSize(22).font('Helvetica-Bold').text(company?.name ?? 'Company', leftCol, startY);
    doc.fontSize(10).font('Helvetica').fillColor('#666666');
    if (company?.website) doc.text(company.website);
    
    doc.fillColor('#000000');
    doc.fontSize(14).font('Helvetica-Bold').text('PAYSLIP', leftCol, startY, { align: 'right' });
    doc.fontSize(12).font('Helvetica').text(monthName, { align: 'right' });
    
    doc.moveDown(1);
    doc.moveTo(leftCol, doc.y).lineTo(leftCol + pageWidth, doc.y).stroke('#2563eb');
    doc.moveDown(1);

    // ── Employee Details Box ──
    const empY = doc.y;
    doc.rect(leftCol, empY, pageWidth, 70).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#000000');
    
    const emp = payroll.employee;
    doc.fontSize(10).font('Helvetica-Bold').text('Employee Name:', leftCol + 15, empY + 15);
    doc.font('Helvetica').text(`${emp.user.firstName} ${emp.user.lastName}`, leftCol + 110, empY + 15);
    
    doc.font('Helvetica-Bold').text('Employee Code:', leftCol + 15, empY + 35);
    doc.font('Helvetica').text(emp.employeeCode, leftCol + 110, empY + 35);
    
    doc.font('Helvetica-Bold').text('Department:', leftCol + (pageWidth/2), empY + 15);
    doc.font('Helvetica').text(emp.department?.name ?? '\u2014', leftCol + (pageWidth/2) + 80, empY + 15);
    
    doc.font('Helvetica-Bold').text('Designation:', leftCol + (pageWidth/2), empY + 35);
    doc.font('Helvetica').text(emp.designation?.title ?? '\u2014', leftCol + (pageWidth/2) + 80, empY + 35);
    
    doc.y = empY + 90;

    // ── Attendance Summary Box ──
    const attY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold').text('Attendance Summary', leftCol, attY);
    doc.moveDown(0.5);
    
    const attrs = [
      ['Working Days', String(payroll.workingDays)],
      ['Present Days', String(payroll.presentDays)],
      ['Unpaid Leaves', String(payroll.unpaidLeaveDays)],
      ['Shortfall Days', String(payroll.absentDays)],
      ['Payable Days', fmt(Number(payroll.payableDays), 1)],
    ];
    
    const attColW = pageWidth / attrs.length;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569');
    attrs.forEach(([label], i) => doc.text(label, leftCol + i * attColW, doc.y, { width: attColW, align: 'center' }));
    doc.moveDown(0.5);
    const valY = doc.y;
    doc.font('Helvetica').fontSize(11).fillColor('#0f172a');
    attrs.forEach(([, value], i) => doc.text(value, leftCol + i * attColW, valY, { width: attColW, align: 'center' }));
    
    doc.moveDown(2);

    // ── Earnings & Deductions Tables (Side by Side) ──
    const tableY = doc.y;
    const halfWidth = (pageWidth / 2) - 10;
    
    // Earnings Header
    doc.rect(leftCol, tableY, halfWidth, 25).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
    doc.text('Earnings', leftCol + 10, tableY + 7);
    doc.text('Amount', leftCol + halfWidth - 80, tableY + 7, { width: 70, align: 'right' });
    
    // Deductions Header
    const rightTableX = leftCol + halfWidth + 20;
    doc.rect(rightTableX, tableY, halfWidth, 25).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
    doc.text('Deductions', rightTableX + 10, tableY + 7);
    doc.text('Amount', rightTableX + halfWidth - 80, tableY + 7, { width: 70, align: 'right' });
    
    // Draw Rows
    let earnRowY = tableY + 35;
    let dedRowY = tableY + 35;
    doc.font('Helvetica').fontSize(10);
    
    // Ratio for prorating earnings to match what was calculated (Earned / Base)
    // Actually, backend calculated net exactly, we just display the breakdown based on what we saved.
    // In our backend, we saved `allowances = earnedGross` and `deductions = totalDeductions`.
    // We should display prorated earnings.
    const earningRatio = Number(payroll.baseSalary) > 0 ? Number(payroll.allowances) / Number(payroll.baseSalary) : 1;
    
    for (const a of allowanceItems) {
      const proratedAmount = a.amount * earningRatio;
      doc.text(a.label, leftCol + 10, earnRowY);
      doc.text(`${currency}${fmt(proratedAmount)}`, leftCol + halfWidth - 80, earnRowY, { width: 70, align: 'right' });
      earnRowY += 20;
    }
    
    for (const d of deductionItems) {
      doc.text(d.label, rightTableX + 10, dedRowY);
      doc.text(`${currency}${fmt(d.amount)}`, rightTableX + halfWidth - 80, dedRowY, { width: 70, align: 'right' });
      dedRowY += 20;
    }
    
    const maxRowY = Math.max(earnRowY, dedRowY) + 10;
    
    // Totals Row
    doc.rect(leftCol, maxRowY, halfWidth, 25).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.rect(rightTableX, maxRowY, halfWidth, 25).fillAndStroke('#f8fafc', '#cbd5e1');
    
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
    doc.text('Gross Earnings', leftCol + 10, maxRowY + 7);
    doc.text(`${currency}${fmt(Number(payroll.allowances))}`, leftCol + halfWidth - 80, maxRowY + 7, { width: 70, align: 'right' });
    
    doc.text('Total Deductions', rightTableX + 10, maxRowY + 7);
    doc.text(`${currency}${fmt(Number(payroll.deductions))}`, rightTableX + halfWidth - 80, maxRowY + 7, { width: 70, align: 'right' });
    
    doc.y = maxRowY + 50;

    // ── Net Pay Section ──
    doc.rect(leftCol, doc.y, pageWidth, 40).fillAndStroke('#ecfdf5', '#a7f3d0');
    doc.fillColor('#065f46').fontSize(14).font('Helvetica-Bold');
    doc.text('Net Take-Home Pay:', leftCol + 15, doc.y - 40 + 12);
    doc.text(`${currency}${fmt(Number(payroll.netSalary))}`, leftCol, doc.y - 40 + 12, { width: pageWidth - 15, align: 'right' });
    
    doc.moveDown(3);

    // ── Footer ──
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
    doc.text('This is a computer-generated document. No signature is required.', leftCol, doc.y, { align: 'center', width: pageWidth });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  // Generate Report (Kept Mostly Same, Just Minified for brevity)
  async generatePayrollReportPdf(companyId: string, month: number, year: number): Promise<Buffer> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, currency: true },
    });

    const payrolls = await prisma.payroll.findMany({
      where: { employee: { companyId, deletedAt: null }, month, year },
      include: { employee: { select: { employeeCode: true, department: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const currency = company?.currency === 'INR' ? '\u20B9' : '$';
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    doc.fontSize(20).font('Helvetica-Bold').text(company?.name ?? 'Company', 50, 50);
    doc.fontSize(14).text(`Payroll Report - ${monthName}`, { align: 'right' });
    doc.moveDown(0.5).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc').moveDown(0.5);

    const totals = { count: payrolls.length, base: 0, allowances: 0, deductions: 0, net: 0 };
    for (const p of payrolls) {
      totals.base += Number(p.baseSalary); totals.allowances += Number(p.allowances);
      totals.deductions += Number(p.deductions); totals.net += Number(p.netSalary);
    }

    doc.fontSize(11).font('Helvetica-Bold').text('Summary', 50).moveDown(0.3).font('Helvetica').fontSize(9);
    const sumData = [['Total Employees', String(totals.count)], ['Total CTC', `${currency}${fmt(totals.base)}`], ['Total Earned Gross', `${currency}${fmt(totals.allowances)}`], ['Total Deductions', `${currency}${fmt(totals.deductions)}`], ['Total Net Payout', `${currency}${fmt(totals.net)}`]];
    const sumY = doc.y;
    sumData.forEach(([label, value], i) => {
      const col = i % 2; const row = Math.floor(i / 2); const x = 50 + col * (doc.page.width / 2 - 75);
      doc.font('Helvetica-Bold').text(label, x, sumY + row * 18, { width: 200 });
      doc.font('Helvetica').text(value, x + 150, sumY + row * 18, { width: 100, align: 'right' });
    });

    doc.moveDown(3).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#cccccc').moveDown(0.5);

    const tY = doc.y;
    const cols = [{ label: 'Employee', x: 50, w: 120 }, { label: 'Earned Gross', x: 170, w: 90, align: 'right' as const }, { label: 'Deductions', x: 270, w: 90, align: 'right' as const }, { label: 'Net', x: 370, w: 90, align: 'right' as const }];
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555');
    cols.forEach(c => doc.text(c.label, c.x, tY, { width: c.w, align: c.align ?? 'left' }));
    doc.moveDown(0.3).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#eeeeee').moveDown(0.2);

    doc.font('Helvetica').fontSize(8).fillColor('#000000');
    for (const p of payrolls) {
      const name = p.employee ? `${p.employee.user.firstName} ${p.employee.user.lastName}` : '\u2014';
      const rowY = doc.y;
      doc.text(name, 50, rowY, { width: 120 });
      doc.text(`${currency}${fmt(p.allowances)}`, 170, rowY, { width: 90, align: 'right' });
      doc.text(`${currency}${fmt(p.deductions)}`, 270, rowY, { width: 90, align: 'right' });
      doc.text(`${currency}${fmt(p.netSalary)}`, 370, rowY, { width: 90, align: 'right' });
      doc.moveDown(0.5);
      if (doc.y > 700) doc.addPage();
    }

    doc.end();
    return new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));
  }
}

export const payslipService = new PayslipService();
