export interface FerryScheduleEntry {
  direction: string;
  day_type: string;
  departure_time: string;
  arrival_time: string;
  remarks?: string;
}

export interface NextFerry {
  direction: string;
  from: string;
  to: string;
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

export interface NextArrival {
  direction: string;
  from: string;
  to: string;
  arrivalTime: string;
  timeUntil: string;
  isToday: boolean;
}