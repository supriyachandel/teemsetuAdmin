import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-border/40 bg-card/60 backdrop-blur-md', className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="rounded-xl bg-primary/10 p-2.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 ring-1 ring-primary/20">
          <Icon className="h-4 w-4 transition-colors" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/80">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1 font-medium">{description}</p>}
        {trend && (
          <p className={cn('text-xs mt-2 font-medium flex items-center', trend.value >= 0 ? 'text-emerald-500' : 'text-red-500')}>
            <span className="mr-1">{trend.value >= 0 ? '↑' : '↓'}</span>
            {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
