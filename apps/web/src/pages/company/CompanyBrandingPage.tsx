import { useEffect, useRef, useState } from 'react';
import { Building2, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchCompanyBranding, setCompanyBranding } from '@/store/slices/companySlice';
import { getAssetUrl } from '@/lib/utils';

export function CompanyBrandingPage() {
  const dispatch = useAppDispatch();
  const branding = useAppSelector((s) => s.company.branding);
  const loading = useAppSelector((s) => s.company.loading);
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    dispatch(fetchCompanyBranding());
  }, [dispatch]);

  useEffect(() => {
    if (branding?.name) setCompanyName(branding.name);
  }, [branding?.name]);

  const saveName = async () => {
    setSavingName(true);
    try {
      const res = await api.patch('/company/branding', { name: companyName.trim() });
      dispatch(setCompanyBranding(res.data.data));
      toast.success('Company name updated');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingName(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await api.post('/company/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch(setCompanyBranding(res.data.data));
      toast.success('Company logo uploaded');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    try {
      const res = await api.delete('/company/logo');
      dispatch(setCompanyBranding(res.data.data));
      toast.success('Company logo removed');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Company Branding
        </h1>
        <p className="text-muted-foreground">
          Upload your company logo and name — shown across the app for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !branding ? (
            <Skeleton className="h-32 w-32 rounded-lg" />
          ) : (
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border bg-muted/30 overflow-hidden">
                {branding?.logoUrl ? (
                  <img
                    src={getAssetUrl(branding.logoUrl)}
                    alt={`${branding.name} logo`}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="text-center text-xs text-muted-foreground px-2">
                    No logo yet
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo(file);
                  }}
                />
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </Button>
                {branding?.logoUrl && (
                  <Button type="button" variant="outline" onClick={removeLogo}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Logo
                  </Button>
                )}
                <p className="text-xs text-muted-foreground max-w-sm">
                  PNG, JPG, WebP, GIF or SVG. Max 2 MB. Your logo appears in the sidebar for all
                  users in your company.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Display name</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
              disabled={loading}
            />
          </div>
          <Button onClick={saveName} disabled={loading || savingName || !companyName.trim()}>
            {savingName ? 'Saving...' : 'Save Name'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
