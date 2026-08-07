import React from 'react';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay, startOfWeek } from 'date-fns';

export type StatusType = 'work_from_home' | 'weekly_off' | 'paid_leave' | 'no_attendance' | 'holiday' | null;

export interface ScheduleEvent {
  id: string;
  startDate: Date;
  endDate: Date;
  type: Exclude<StatusType, null>;
}

export interface EmployeeSchedule {
  id: string;
  name?: string;
  events: ScheduleEvent[];
}

interface TeamScheduleProps {
  startDate: Date;
  daysToDisplay?: number;
  schedules: EmployeeSchedule[];
  className?: string;
}

const statusConfig: Record<Exclude<StatusType, null>, { solid: string; light: string; label: string }> = {
  work_from_home: { solid: 'bg-purple-500 text-white', light: 'bg-purple-200', label: 'Work from home' },
  weekly_off: { solid: 'bg-orange-400 text-white', light: 'bg-orange-200', label: 'Weekly off' },
  paid_leave: { solid: 'bg-teal-400 text-white', light: 'bg-teal-200', label: 'Paid leave' },
  no_attendance: { solid: 'bg-red-500 text-white', light: 'bg-red-200', label: 'No attendance' },
  holiday: { solid: 'bg-blue-400 text-white', light: 'bg-blue-200', label: 'Holiday' },
};

export function TeamSchedule({ startDate, daysToDisplay = 14, schedules, className }: TeamScheduleProps) {
  const dates = Array.from({ length: daysToDisplay }).map((_, i) => addDays(startDate, i));

  // Helper to determine if a date is within an event
  const getEventForDate = (date: Date, events: ScheduleEvent[]) => {
    return events.find((e) => {
      // Normalize dates for comparison (ignoring time)
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const s = new Date(e.startDate.getFullYear(), e.startDate.getMonth(), e.startDate.getDate()).getTime();
      const en = new Date(e.endDate.getFullYear(), e.endDate.getMonth(), e.endDate.getDate()).getTime();
      return d >= s && d <= en;
    });
  };

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="min-w-max border rounded-xl bg-white shadow-sm">
        {/* Header */}
        <div className="flex border-b">
          {/* Optional Name Column Header (empty space) */}
          <div className="w-32 flex-shrink-0 p-3 border-r bg-muted/20"></div>
          {/* Days */}
          <div className="flex flex-1">
            {dates.map((date, i) => (
              <div key={i} className="flex-1 min-w-[3rem] py-3 flex flex-col items-center justify-center gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {format(date, 'eeeee')} {/* S, M, T, W, T, F, S */}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Header Dates */}
        <div className="flex border-b">
          <div className="w-32 flex-shrink-0 p-3 border-r bg-muted/20 flex items-center text-sm font-medium text-muted-foreground">
            Employee
          </div>
          <div className="flex flex-1">
            {dates.map((date, i) => (
              <div key={i} className="flex-1 min-w-[3rem] py-3 flex items-center justify-center">
                <span className="text-sm font-medium text-muted-foreground">
                  {format(date, 'd')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid rows */}
        <div className="flex flex-col">
          {schedules.map((schedule, rowIndex) => (
            <div key={schedule.id} className={cn("flex", rowIndex !== schedules.length - 1 && "border-b")}>
              {/* Name Column */}
              <div className="w-32 flex-shrink-0 p-3 border-r flex items-center">
                <span className="text-sm font-medium truncate">{schedule.name || `Emp ${schedule.id}`}</span>
              </div>
              
              {/* Schedule row */}
              <div className="flex flex-1 relative py-2">
                {dates.map((date, colIndex) => {
                  const event = getEventForDate(date, schedule.events);
                  const isFirstDay = event && isSameDay(date, event.startDate);
                  const isLastDay = event && isSameDay(date, event.endDate);
                  const isSingleDay = event && isFirstDay && isLastDay;
                  
                  // For rendering the connecting pill
                  const hasConnectingPill = !!event;

                  return (
                    <div key={colIndex} className="flex-1 min-w-[3rem] flex items-center justify-center relative">
                      {/* Connecting Background Pill */}
                      {hasConnectingPill && (
                        <div 
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 h-8",
                            statusConfig[event.type].light,
                            isFirstDay ? "left-1/2 rounded-l-full w-1/2" : "",
                            isLastDay ? "right-1/2 rounded-r-full w-1/2" : "",
                            (!isFirstDay && !isLastDay) ? "left-0 w-full" : "",
                            isSingleDay ? "left-1/2 -translate-x-1/2 w-8 rounded-full" : ""
                          )}
                        />
                      )}
                      
                      {/* Circular Date Indicator */}
                      {event ? (
                        <div className={cn(
                          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                          statusConfig[event.type].solid
                        )}>
                          {format(date, 'd')}
                        </div>
                      ) : (
                        <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm text-muted-foreground/50">
                          {format(date, 'd')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="p-4 border-t flex flex-wrap items-center justify-center gap-6 text-sm">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", config.solid)} />
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
