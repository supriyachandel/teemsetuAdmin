import { dashboardRepository } from '../repositories/dashboard.repository';

export class DashboardService {
  async getDashboard(
    companyId: string,
    role: string,
    employeeId?: string | null
  ) {
    if (role === 'SUPER_ADMIN') {
      return dashboardRepository.getSuperAdminStats(companyId);
    }
    return dashboardRepository.getRoleStats(companyId, role, employeeId);
  }

  async globalSearch(companyId: string, query: string) {
    if (!query || query.length < 2) return { employees: [], projects: [], tasks: [] };
    return dashboardRepository.globalSearch(companyId, query);
  }
}

export const dashboardService = new DashboardService();
