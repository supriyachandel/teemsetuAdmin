import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const apiBase = new URL(apiUrl, window.location.origin).origin;
    const parsed = new URL(url, window.location.origin);
    
    // Dynamically resolve local uploads to the current API base URL
    // This prevents broken images when migrating environments or changing domains
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${apiBase}${parsed.pathname}`;
    }
  } catch (e) {
    // If URL parsing fails, return original
  }
  
  return url;
}
