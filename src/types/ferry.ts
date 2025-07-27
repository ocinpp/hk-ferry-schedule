export interface FerryScheduleEntry {
  direction: string;
  day_type: string;
  departure_time: string;
  arrival_time: string;
  remarks?: string;
}

export interface NextFerry {
  direction: string;
  departureTime: string;
  arrivalTime: string;
  timeUntil: string;
  isToday: boolean;
  remarks?: string;
}

export interface PublicHoliday {
  summary: string;
  dtstart: {
    date?: string;
    'date-time'?: string;
  };
}