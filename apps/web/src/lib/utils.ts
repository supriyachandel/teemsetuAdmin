import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  let apiBase = '';
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';
    
    // Handle cases where apiUrl is missing https:// protocol
    const validApiUrl = apiUrl.startsWith('http') ? apiUrl : `https://${apiUrl}`;
    
    apiBase = apiUrl.startsWith('/') 
      ? window.location.origin 
      : new URL(validApiUrl).origin;
      
    const parsed = new URL(url, window.location.origin);
    
    // Dynamically resolve local uploads to the current API base URL
    // This prevents broken images when migrating environments or changing domains
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${apiBase}${parsed.pathname}`;
    }
  } catch (e) {
    // If URL parsing fails, continue to fallback
  }
  
  // Aggressive fallback for legacy localhost URLs in the database
  if (url.includes('localhost:')) {
    return url.replace(/https?:\/\/localhost:\d+/, apiBase || window.location.origin);
  }
  
  return url;
}
