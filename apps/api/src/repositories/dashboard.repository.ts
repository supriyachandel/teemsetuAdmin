import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export class DashboardRepository {
  async getSuperAdminStats(companyId: string) {
    const [
      totalEmployees,
      activeProjects,
      pendingLeaves,
      todayAttendance,
      recentActivities,
    ] = await Promise.all([
      prisma.employee.count({
        where: { companyId, deletedAt: null, employmentStatus: 'ACTIVE' },
      }),
      prisma.project.count({
        where: { companyId, deletedAt: null, status: { in: ['ACTIVE', 'PLANNING'] } },
      }),
      prisma.leaveRequest.count({
        where: {
          employee: { companyId },
          status: 'PENDING',
        },
      }),
      prisma.attendance.count({
        where: {
          employee: { companyId },
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          status: { in: ['PRESENT', 'LATE', 'REMOTE'] },
        },
      }),
      prisma.auditLog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    const employeeGrowth = await prisma.$queryRaw<{ month: string; count: bigint }[]>(
      Prisma.sql`
        SELECT DATE_FORMAT(joining_date, '%b %Y') AS month,
               COUNT(*) AS count
        FROM employees
        WHERE company_id = ${companyId}
          AND deleted_at IS NULL
          AND joining_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY YEAR(joining_date), MONTH(joining_date), DATE_FORMAT(joining_date, '%b %Y')
        ORDER BY YEAR(joining_date), MONTH(joining_date)
      `
    );

    // Project Status distribution
    const projectsByStatus = await prisma.project.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { id: true }
    });

    // 7 days attendance trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const attendanceTrendRaw = await prisma.attendance.groupBy({
      by: ['date'],
      where: { 
        employee: { companyId },
        date: { gte: sevenDaysAgo },
        status: { in: ['PRESENT', 'LATE', 'REMOTE'] }
      },
      _count: { id: true },
      orderBy: { date: 'asc' }
    });

    const attendanceTrend = attendanceTrendRaw.map(r => ({
      day: r.date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: r._count.id
    }));

    // Payroll expenses 6 months
    const payrollExpensesRaw = await prisma.$queryRaw<{ month: number, year: number, total: number }[]>`
      SELECT p.month, p.year, SUM(p.net_salary) as total
      FROM payrolls p
      JOIN employees e ON p.employee_id = e.id
      WHERE e.company_id = ${companyId} AND p.status = 'PAID'
      GROUP BY p.year, p.month
      ORDER BY p.year DESC, p.month DESC
      LIMIT 6
    `;

    const payrollExpensesTrend = payrollExpensesRaw.map(r => {
      const date = new Date(r.year, r.month - 1);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        amount: Number(r.total) || 0
      };
    }).reverse();

    return {
      totalEmployees,
      activeProjects,
      pendingLeaves,
      todayAttendance,
      recentActivities,
      employeeGrowth: employeeGrowth.map((r) => ({
        month: r.month,
        count: Number(r.count),
      })),
      projectsByStatus: projectsByStatus.map(p => ({
        status: p.status,
        count: p._count.id
      })),
      attendanceTrend,
      payrollExpensesTrend,
      revenue: { total: 0, growth: 0 },
      payrollExpenses: { total: 0, month: new Date().getMonth() + 1 },
    };
  }

  async getRoleStats(companyId: string, role: string, employeeId?: string | null) {
    const base = {
      employees: await prisma.employee.count({
        where: { companyId, deletedAt: null },
      }),
      projects: await prisma.project.count({
        where: { companyId, deletedAt: null, status: { in: ['ACTIVE', 'PLANNING'] } },
      }),
      tasks: await prisma.task.count({
        where: {
          project: { companyId },
          deletedAt: null,
          status: { not: 'COMPLETED' },
        },
      }),
      notifications: await prisma.notification.count({
        where: { user: { companyId }, isRead: false },
      }),
    };

    let attendanceTrend = [];
    if (employeeId) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0,0,0,0);
      const raw = await prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: sevenDaysAgo },
          status: { in: ['PRESENT', 'LATE', 'REMOTE'] }
        },
        orderBy: { date: 'asc' }
      });
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      attendanceTrend = raw.map(r => ({
        day: days[r.date.getDay()],
        count: 1
      }));
    } else {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const attendanceTrendRaw = await prisma.attendance.groupBy({
        by: ['date'],
        where: { 
          employee: { companyId },
          date: { gte: sevenDaysAgo },
          status: { in: ['PRESENT', 'LATE', 'REMOTE'] }
        },
        _count: { id: true },
        orderBy: { date: 'asc' }
      });

      attendanceTrend = attendanceTrendRaw.map(r => ({
        day: r.date.toLocaleDateString('en-US', { weekday: 'short' }),
        count: r._count.id
      }));
    }
    
    // Project Status distribution (so Managers/HR can also see it)
    const projectsByStatus = await prisma.project.groupBy({
      by: ['status'],
      where: { companyId, deletedAt: null },
      _count: { id: true }
    });

    const pByStatus = projectsByStatus.map(p => ({
      status: p.status,
      count: p._count.id
    }));

    if (role === 'HR') {
      return {
        ...base,
        pendingLeaves: await prisma.leaveRequest.count({
          where: { employee: { companyId }, status: 'PENDING' },
        }),
        newHires: await prisma.employee.count({
          where: {
            companyId,
            joiningDate: { gte: new Date(new Date().setDate(1)) },
          },
        }),
        attendanceTrend,
        projectsByStatus: pByStatus
      };
    }

    if (role === 'MANAGER') {
      return {
        ...base,
        teamTasks: base.tasks,
        pendingLeaves: await prisma.leaveRequest.count({
          where: { employee: { companyId }, status: 'PENDING' },
        }),
        attendanceTrend,
        projectsByStatus: pByStatus
      };
    }

    if (role === 'EMPLOYEE' && employeeId) {
      const assignedTasks = await prisma.task.findMany({
        where: {
          assigneeId: employeeId,
          deletedAt: null,
          status: { not: 'COMPLETED' },
        },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        ...base,
        myTasks: assignedTasks.length,
        assignedTasks,
        pendingLeaves: await prisma.leaveRequest.count({
          where: { employeeId, status: 'PENDING' },
        }),
        leaveBalance: 0,
        attendanceTrend,
        projectsByStatus: pByStatus
      };
    }

    return {
      ...base,
      myTasks: base.tasks,
      pendingLeaves: 0,
      leaveBalance: 0,
      attendanceTrend,
      projectsByStatus: pByStatus
    };
  }

  async globalSearch(companyId: string, query: string) {
    const q = `%${query}%`;
    const [employees, projects, tasks] = await Promise.all([
      prisma.$queryRaw`
        SELECT e.id, u.first_name as firstName, u.last_name as lastName, e.employee_code as code
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.company_id = ${companyId} 
          AND e.deleted_at IS NULL
          AND (u.first_name LIKE ${q} OR u.last_name LIKE ${q} OR e.employee_code LIKE ${q} OR u.email LIKE ${q})
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT p.id, p.name, p.status
        FROM projects p
        WHERE p.company_id = ${companyId}
          AND p.deleted_at IS NULL
          AND p.name LIKE ${q}
        LIMIT 5
      `,
      prisma.$queryRaw`
        SELECT t.id, t.title, p.id as projectId, p.name as projectName
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.company_id = ${companyId}
          AND t.deleted_at IS NULL
          AND t.title LIKE ${q}
        LIMIT 5
      `
    ]);

    return {
      employees,
      projects,
      tasks,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
