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

    const currency = '\u20B9'; // Enforce Rupee sign based on user preference
    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // A4 size: 595.28 x 841.89
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const employeeSalary = await prisma.employeeSalary.findUnique({
      where: { employeeId: payroll.employeeId },
      include: {
        salaryStructure: {
          include: {
            allowances: true,
            deductions: true,
          }
        }
      }
    });

    const decToNum = (val: unknown) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return Number(val);
      if (val && typeof val === 'object' && 'toString' in val) {
        return Number((val as { toString: () => string }).toString());
      }
      return 0;
    };

    const basicPay = employeeSalary ? decToNum(employeeSalary.basicPay) : 0;

    const allowanceItems = (employeeSalary?.salaryStructure?.allowances ?? []).map(a => {
      const value = decToNum(a.value);
      const amount = a.calculationType === 'PERCENTAGE' ? (basicPay * value / 100) : value;
      return { label: a.name, amount };
    });

    const deductionItems = (employeeSalary?.salaryStructure?.deductions ?? []).map(d => {
      const value = decToNum(d.value);
      const amount = d.calculationType === 'PERCENTAGE' ? (basicPay * value / 100) : value;
      return { label: d.name, amount };
    });

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    
    // Background watermark
    doc.save();
    doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
    doc.fontSize(60).fillColor('#f8fafc').font('Helvetica-Bold').text('CONFIDENTIAL', pageWidth/2 - 200, pageHeight/2, { align: 'center', width: 400 });
    doc.restore();

    // --- Header Section ---
    const primaryColor = '#1e3a8a'; // Deep blue
    const accentColor = '#3b82f6';
    const textColor = '#334155';
    const mutedColor = '#64748b';

    // Header Background Bar
    doc.rect(0, 0, pageWidth, 120).fill(primaryColor);
    
    let startY = 35;
    
    // Fallback Logo / Actual Logo
    let logoDrawn = false;
    if (company?.logoUrl) {
      const imgBuffer = await fetchImage(company.logoUrl);
      if (imgBuffer) {
        try {
          doc.image(imgBuffer, margin, startY, { fit: [100, 50] });
          logoDrawn = true;
        } catch (e) { }
      }
    }
    
    if (!logoDrawn) {
      // Draw a professional text logo badge
      doc.rect(margin, startY, 50, 50).fill('#ffffff');
      doc.fillColor(primaryColor).fontSize(28).font('Helvetica-Bold').text((company?.name ?? 'C').charAt(0).toUpperCase(), margin, startY + 10, { width: 50, align: 'center' });
    }

    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text(company?.name ?? 'Company Name', margin + (logoDrawn ? 110 : 70), startY + 5);
    doc.fontSize(10).font('Helvetica').fillColor('#cbd5e1').text(company?.website || 'www.company.com', margin + (logoDrawn ? 110 : 70), startY + 32);
    
    // Payslip Title & Date on the right
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('PAYSLIP', margin, startY, { align: 'right', width: contentWidth });
    doc.fontSize(12).font('Helvetica').fillColor('#93c5fd').text(`For the month of ${monthName}`, margin, startY + 25, { align: 'right', width: contentWidth });

    // --- Employee Info Section ---
    let y = 140;
    const emp = payroll.employee;
    
    doc.roundedRect(margin, y, contentWidth, 90, 6).fill('#f8fafc');
    doc.roundedRect(margin, y, contentWidth, 90, 6).lineWidth(1).stroke('#e2e8f0');
    
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('Employee Details', margin + 15, y + 15);
    
    y += 40;
    doc.fontSize(10).fillColor(mutedColor).font('Helvetica').text('Name:', margin + 15, y);
    doc.fillColor(textColor).font('Helvetica-Bold').text(`${emp.user.firstName} ${emp.user.lastName}`, margin + 60, y);
    
    doc.fillColor(mutedColor).font('Helvetica').text('Code:', margin + 15, y + 20);
    doc.fillColor(textColor).font('Helvetica-Bold').text(emp.employeeCode, margin + 60, y + 20);
    
    doc.fillColor(mutedColor).font('Helvetica').text('Department:', margin + (contentWidth / 2), y);
    doc.fillColor(textColor).font('Helvetica-Bold').text(emp.department?.name ?? 'N/A', margin + (contentWidth / 2) + 70, y);
    
    doc.fillColor(mutedColor).font('Helvetica').text('Designation:', margin + (contentWidth / 2), y + 20);
    doc.fillColor(textColor).font('Helvetica-Bold').text(emp.designation?.title ?? 'N/A', margin + (contentWidth / 2) + 70, y + 20);

    // --- Attendance Summary Section ---
    y += 70;
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text('Attendance Summary', margin, y);
    y += 20;
    
    const attrs = [
      ['Working Days', String(payroll.workingDays)],
      ['Present Days', String(payroll.presentDays)],
      ['Unpaid Leaves', String(payroll.unpaidLeaveDays)],
      ['Shortfall Days', String(payroll.absentDays)],
      ['Payable Days', fmt(Number(payroll.payableDays), 1)],
    ];
    
    const attColW = contentWidth / attrs.length;
    doc.rect(margin, y, contentWidth, 40).fill('#f1f5f9');
    
    // Borders inside the attendance block
    doc.lineWidth(0.5).strokeColor('#cbd5e1');
    for(let i=1; i<attrs.length; i++) {
      doc.moveTo(margin + i*attColW, y + 5).lineTo(margin + i*attColW, y + 35).stroke();
    }
    
    doc.fillColor(mutedColor).fontSize(9).font('Helvetica');
    attrs.forEach(([label], i) => doc.text(label, margin + i * attColW, y + 8, { width: attColW, align: 'center' }));
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold');
    attrs.forEach(([, value], i) => doc.text(value, margin + i * attColW, y + 22, { width: attColW, align: 'center' }));

    // --- Earnings & Deductions Tables ---
    y += 70;
    const halfWidth = (contentWidth / 2) - 10;
    const rightCol = margin + halfWidth + 20;

    // Headers
    doc.roundedRect(margin, y, halfWidth, 25, 4).fill(primaryColor);
    doc.roundedRect(rightCol, y, halfWidth, 25, 4).fill(primaryColor);
    
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
    doc.text('EARNINGS', margin + 15, y + 7);
    doc.text('AMOUNT', margin + halfWidth - 80, y + 7, { width: 65, align: 'right' });
    
    doc.text('DEDUCTIONS', rightCol + 15, y + 7);
    doc.text('AMOUNT', rightCol + halfWidth - 80, y + 7, { width: 65, align: 'right' });

    y += 35;
    
    let earnRowY = y;
    let dedRowY = y;
    
    const employeeSalaryBasic = employeeSalary ? decToNum(employeeSalary.basicPay) : 0;
    const earningRatio = employeeSalaryBasic > 0 ? Number(payroll.basicPay) / employeeSalaryBasic : 1;
    
    const printedEarnings = [
      { label: 'Basic Pay', amount: Number(payroll.basicPay) },
      ...allowanceItems.map(a => ({ label: a.label, amount: a.amount * earningRatio }))
    ];

    const printedDeductions = [
      ...deductionItems.map(d => ({ label: d.label, amount: d.amount * earningRatio }))
    ];
    if (Number(payroll.pfEmployee) > 0) {
      printedDeductions.push({ label: 'Provident Fund (PF)', amount: Number(payroll.pfEmployee) });
    }
    if (Number(payroll.esiEmployee) > 0) {
      printedDeductions.push({ label: 'Employee State Insurance (ESI)', amount: Number(payroll.esiEmployee) });
    }
    if (Number(payroll.tax) > 0) {
      printedDeductions.push({ label: 'Income Tax / TDS', amount: Number(payroll.tax) });
    }

    doc.fontSize(10).font('Helvetica');
    
    for (const a of printedEarnings) {
      doc.fillColor(textColor).text(a.label, margin + 15, earnRowY);
      doc.fillColor('#000000').text(`${currency}${fmt(a.amount)}`, margin + halfWidth - 85, earnRowY, { width: 70, align: 'right' });
      earnRowY += 22;
    }
    
    for (const d of printedDeductions) {
      doc.fillColor(textColor).text(d.label, rightCol + 15, dedRowY);
      doc.fillColor('#000000').text(`${currency}${fmt(d.amount)}`, rightCol + halfWidth - 85, dedRowY, { width: 70, align: 'right' });
      dedRowY += 22;
    }
    
    const maxRowY = Math.max(earnRowY, dedRowY) + 15;
    
    // Divider line before totals
    doc.moveTo(margin, maxRowY - 5).lineTo(margin + halfWidth, maxRowY - 5).lineWidth(1).stroke('#e2e8f0');
    doc.moveTo(rightCol, maxRowY - 5).lineTo(rightCol + halfWidth, maxRowY - 5).lineWidth(1).stroke('#e2e8f0');

    // Totals
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11);
    doc.text('Gross Earnings', margin + 15, maxRowY);
    doc.text(`${currency}${fmt(Number(payroll.baseSalary))}`, margin + halfWidth - 100, maxRowY, { width: 85, align: 'right' });
    
    doc.fillColor('#dc2626').text('Total Deductions', rightCol + 15, maxRowY);
    doc.text(`${currency}${fmt(Number(payroll.deductions))}`, rightCol + halfWidth - 100, maxRowY, { width: 85, align: 'right' });

    // --- Net Pay Banner ---
    y = maxRowY + 40;
    
    doc.roundedRect(margin, y, contentWidth, 50, 8).fill('#f0fdf4');
    doc.roundedRect(margin, y, contentWidth, 50, 8).lineWidth(1).stroke('#bbf7d0');
    
    doc.fillColor('#166534').fontSize(14).font('Helvetica-Bold');
    doc.text('NET TAKE-HOME PAY', margin + 20, y + 18);
    doc.fontSize(22).text(`${currency}${fmt(Number(payroll.netSalary))}`, margin, y + 13, { width: contentWidth - 20, align: 'right' });
    
    // Amount in words
    y += 60;
    doc.fillColor(mutedColor).fontSize(9).font('Helvetica-Oblique');
    
    // simple number to words (mock for visual appeal, or just skip if too complex, let's keep it simple)
    doc.text(`* This payslip is electronically generated and does not require a signature.`, margin, y);

    // --- Footer ---
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica');
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, pageHeight - 50, { align: 'center', width: contentWidth });

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
