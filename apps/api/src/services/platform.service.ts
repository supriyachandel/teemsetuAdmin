import { prisma } from '../config/database';

export class PlatformService {
  async getDashboardStats() {
    const totalCompanies = await prisma.company.count({
      where: { slug: { not: 'system-admin' } },
    });

    const activeUsers = await prisma.user.count({
      where: { status: 'ACTIVE' },
    });

    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'ACTIVE' },
    });

    const subscriptions = await prisma.subscription.findMany({
      include: { planDetails: true },
    });

    const estimatedRevenue = subscriptions.reduce((acc, sub) => {
      if (sub.status === 'ACTIVE' && sub.planDetails) {
        return acc + Number(sub.planDetails.monthlyPrice);
      }
      return acc;
    }, 0);

    return {
      totalCompanies,
      activeUsers,
      activeSubscriptions,
      estimatedRevenue,
    };
  }

  async getCompanies() {
    return prisma.company.findMany({
      where: { slug: { not: 'system-admin' } },
      include: {
        subscription: {
          include: { planDetails: true },
        },
        _count: {
          select: { users: true, employees: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const platformService = new PlatformService();
