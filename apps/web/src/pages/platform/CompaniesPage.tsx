import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string;
  createdAt: string;
  _count: {
    users: number;
    employees: number;
  };
  subscription?: {
    status: string;
    planDetails?: {
      displayName: string;
      monthlyPrice: number;
    };
  };
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/platform/companies')
      .then((res) => setCompanies(res.data.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">Manage platform tenants and their subscriptions</p>
      </div>

      <Card className="border-border/40 bg-background/60 backdrop-blur-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Registered Companies ({companies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="p-4 font-medium text-muted-foreground">Name</th>
                  <th className="p-4 font-medium text-muted-foreground">Slug</th>
                  <th className="p-4 font-medium text-muted-foreground">Industry</th>
                  <th className="p-4 font-medium text-muted-foreground">Users</th>
                  <th className="p-4 font-medium text-muted-foreground">Plan</th>
                  <th className="p-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="p-4 font-medium">{company.name}</td>
                    <td className="p-4 text-muted-foreground">{company.slug}</td>
                    <td className="p-4">{company.industry || '—'}</td>
                    <td className="p-4 flex items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      {company._count.users}
                    </td>
                    <td className="p-4 font-medium text-primary">
                      {company.subscription?.planDetails?.displayName || 'Free Trial'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        company.subscription?.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {company.subscription?.status || 'UNKNOWN'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
