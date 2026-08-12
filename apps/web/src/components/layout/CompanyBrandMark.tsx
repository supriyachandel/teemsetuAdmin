import { Zap } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { getAssetUrl } from '@/lib/utils';

export function CompanyBrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  const branding = useAppSelector((s) => s.company.branding);

  if (branding?.logoUrl) {
    return (
      <img
        src={getAssetUrl(branding.logoUrl)}
        alt={`${branding.name} logo`}
        className={`${className} rounded-lg object-contain bg-background`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center rounded-lg bg-primary text-primary-foreground`}
    >
      <Zap className="h-4 w-4" />
    </div>
  );
}

export function useCompanyDisplayName() {
  const branding = useAppSelector((s) => s.company.branding);
  return branding?.name ?? 'Nexus CRM';
}
