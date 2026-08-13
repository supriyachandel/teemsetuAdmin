import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, getApiErrorMessage } from '@/lib/api';

interface AttendanceRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  monthlyCount: number;
}

export function AttendanceRequestModal({ open, onOpenChange, onSuccess, monthlyCount }: AttendanceRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monthlyCount >= 10) {
      toast.error('You have reached the maximum limit of 10 requests for this month.');
      return;
    }

    if (!date) {
      toast.error('Please select a date');
      return;
    }

    if (!checkInTime && !checkOutTime) {
      toast.error('Please provide at least a check-in or check-out time');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setLoading(true);
    try {
      // Combine date and time
      const formatDateTime = (timeStr: string) => {
        if (!timeStr) return undefined;
        return new Date(`${date}T${timeStr}:00`).toISOString();
      };

      await api.post('/attendance/requests', {
        date: new Date(date).toISOString(),
        checkInTime: formatDateTime(checkInTime),
        checkOutTime: formatDateTime(checkOutTime),
        reason,
      });

      toast.success('Attendance request submitted successfully');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setDate('');
      setCheckInTime('');
      setCheckOutTime('');
      setReason('');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              Submit a request if you forgot to check in or out.
              <br />
              <span className={monthlyCount >= 10 ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                {monthlyCount}/10 requests used this month.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="checkInTime">Check In Time</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkOutTime">Check Out Time</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Why are you submitting this request?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || monthlyCount >= 10}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
