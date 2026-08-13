import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatTime } from '@/lib/date';
import { useAppSelector } from '@/store/hooks';

interface AttendanceRequest {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  employee?: {
    employeeCode: string;
    user: { firstName: string; lastName: string };
  };
}

export function AttendanceRequestsList() {
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const user = useAppSelector((state) => state.auth.user);
  const canApprove = user?.permissions?.includes('attendance:approve');

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/requests', { params: { limit: 50 } });
      setRequests(res.data.data ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/attendance/requests/${id}/approve`);
      toast.success('Request approved');
      loadRequests();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection?');
    if (reason === null) return;

    setActionLoading(id);
    try {
      await api.patch(`/attendance/requests/${id}/reject`, { rejectionReason: reason });
      toast.success('Request rejected');
      loadRequests();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (requests.length === 0) return <p className="text-sm text-muted-foreground p-6">No requests found.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Date</th>
            {canApprove && <th className="text-left p-3 font-medium">Employee</th>}
            <th className="text-left p-3 font-medium">Requested Time</th>
            <th className="text-left p-3 font-medium">Reason</th>
            <th className="text-left p-3 font-medium">Status</th>
            {canApprove && <th className="text-right p-3 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-3">{new Date(r.date).toLocaleDateString()}</td>
              {canApprove && (
                <td className="p-3">
                  {r.employee ? `${r.employee.user.firstName} ${r.employee.user.lastName}` : '—'}
                </td>
              )}
              <td className="p-3">
                {r.checkInTime && `In: ${formatTime(r.checkInTime)} `}
                {r.checkOutTime && `Out: ${formatTime(r.checkOutTime)}`}
              </td>
              <td className="p-3 max-w-[200px] truncate" title={r.reason}>
                {r.reason}
              </td>
              <td className="p-3">
                <Badge
                  variant={
                    r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'warning' : 'outline'
                  }
                >
                  {r.status}
                </Badge>
                {r.status === 'REJECTED' && r.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]" title={r.rejectionReason}>
                    {r.rejectionReason}
                  </p>
                )}
              </td>
              {canApprove && (
                <td className="p-3 text-right">
                  {r.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                        onClick={() => handleApprove(r.id)}
                        disabled={actionLoading === r.id}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => handleReject(r.id)}
                        disabled={actionLoading === r.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
