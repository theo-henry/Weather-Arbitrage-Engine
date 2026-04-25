export type Activity = 'run' | 'study' | 'social' | 'flight' | 'photo' | 'custom';
export type City = 'Madrid' | 'Barcelona' | 'Valencia' | 'Seville';
export type Confidence = 'High' | 'Medium' | 'Low';
export type Sensitivity = 'low' | 'medium' | 'high';
export type TimeBias = 'morning' | 'neutral' | 'evening';
export type WeatherConditionType = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'drizzle' | 'storm' | 'snow';
export type WeekdayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface ActivityWeatherComfort {
  minTemperature: number;
  maxTemperature: number;
  maxWindSpeed: number;
  maxPrecipitationProbability: number;
}

export interface ActivityPreferenceProfile {
  performanceVsComfort?: number; // 0 (comfort) – 100 (performance)
  windSensitivity?: Sensitivity;
  rainAvoidance?: Sensitivity;
  timeBias?: TimeBias;
  preferCool?: boolean;
  daylightPreference?: number;
  distractionSensitivity?: boolean;
  warmthPreference?: number;
  sunsetBonus?: boolean;
  goldenHourPriority?: boolean;
  cloudPreference?: 'clear' | 'dramatic';
  turbulenceSensitivity?: Sensitivity;
  comfort?: ActivityWeatherComfort;
}

export interface ResolvedActivityPreferences extends ActivityPreferenceProfile {
  activity: Activity;
  city: City;
  usualTime: string;
}

export interface BlockedTimeRule {
  id: string;
  day: WeekdayKey;
  startTime: string; // '08:00'
  endTime: string;   // '10:30'
}

export interface WeatherConditions {
  temperature: number;        // °C
  feelsLike: number;          // °C (heat index / wind chill)
  humidity: number;           // %
  windSpeed: number;          // km/h
  precipitationProbability: number; // %
  precipitation: number;      // mm (actual rainfall amount if raining)
  uvIndex: number;
  cloudCover: number;         // %
  airQuality: number;         // AQI (1-500, lower is better)
  condition: WeatherConditionType;
}

export interface TimeWindow {
  id: string;
  day: string;               // 'Mon', 'Tue', ...
  date: string;              // ISO
  startTime: string;         // '19:30'
  endTime: string;           // '20:30'
  city: City;
  location: string;          // 'Retiro Park'
  weather: WeatherConditions;
  scores: {
    run: number;
    study: number;
    social: number;
    flight: number;
    photo: number;
    custom: number;
  };
  factorBreakdown: Record<string, number>; // 0–100 per factor
  confidence: Confidence;
}

export interface UserPreferences {
  activity: Activity;
  city: City;
  usualTime: string;         // '17:00'
  activityProfiles: Record<Activity, ActivityPreferenceProfile>;
  blockedTimeRules: Record<Activity, BlockedTimeRule[]>;
}

export interface ScheduledEvent {
  id: string;
  title: string;
  activity: Activity;
  window: TimeWindow;
  score: number;
}

export type EventCategory = 'weather-sensitive' | 'indoor';

export type EventColor = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'pink';
export type WeatherRiskLevel = 'low' | 'medium' | 'high';
export type WeatherRelevanceSource = 'tagged' | 'heuristic';

export interface SuggestedAlternative {
  startTime: string; // ISO
  endTime: string;   // ISO
  score: number;
  reason: string;
}

export interface WeatherRisk {
  level: WeatherRiskLevel;
  reasons: string[];
  relevanceSource: WeatherRelevanceSource;
  currentScore?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;          // ISO date string
  endTime: string;            // ISO date string
  category: EventCategory;
  activity?: Activity;        // only for weather-sensitive
  color: EventColor;
  participants?: string[];
  notes?: string;
  location?: string;
  weatherScore?: number;
  weatherRisk?: WeatherRisk;
  suggestedAlternative?: SuggestedAlternative | null;
  createdVia: 'ui' | 'chat' | 'mock' | 'compare';
}

export interface ProtectedEventAnalysis {
  eventId: string;
  event: CalendarEvent;
  riskLevel: WeatherRiskLevel;
  riskReasons: string[];
  isWeatherRelevant: boolean;
  weatherRelevanceSource?: WeatherRelevanceSource;
  currentScore?: number;
  recommendedAlternative?: SuggestedAlternative | null;
  dismissed: boolean;
  suggestionFingerprint?: string;
}

export type PendingCalendarOperation =
  | {
      type: 'create_event';
      summary: string;
      eventDraft: Omit<CalendarEvent, 'id'>;
    }
  | {
      type: 'update_event';
      summary: string;
      eventId: string;
      changes: Partial<CalendarEvent>;
    }
  | {
      type: 'delete_event';
      summary: string;
      eventId: string;
    };

export interface AssistantChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AssistantRequest {
  messages: AssistantChatMessage[];
  events: CalendarEvent[];
  windows: TimeWindow[];
  city: City;
  preferences: UserPreferences;
  now: string;
  timezone: string;
  pendingOperations?: PendingCalendarOperation[] | null;
}

export interface AssistantResponse {
  message: string;
  pendingOperations: PendingCalendarOperation[] | null;
  requiresConfirmation: boolean;
  referencedEventIds?: string[];
  updatedPreferences?: UserPreferences | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pendingOperations?: PendingCalendarOperation[] | null;
  requiresConfirmation?: boolean;
  referencedEventIds?: string[];
  isError?: boolean;
}

export interface Intent {
  activity: Activity | null;
  duration?: string;
  dayHint?: string;
  locationHint?: string;
  raw: string;
}

// Activity metadata for UI
export const ACTIVITY_CONFIG: Record<Activity, { label: string; icon: string; factors: string[] }> = {
  run: {
    label: 'Run / Workout',
    icon: 'running',
    factors: ['temperature', 'humidity', 'wind', 'rain', 'uv', 'timing'],
  },
  study: {
    label: 'Deep Work / Study',
    icon: 'book',
    factors: ['thermal', 'daylight', 'distraction', 'timing'],
  },
  social: {
    label: 'Outdoor Social',
    icon: 'wine',
    factors: ['temperature', 'rain', 'wind', 'sunset', 'atmosphere'],
  },
  flight: {
    label: 'Flights',
    icon: 'plane',
    factors: ['turbulence', 'weather', 'stability', 'timing'],
  },
  photo: {
    label: 'Photography',
    icon: 'camera',
    factors: ['golden_hour', 'cloud_drama', 'rain', 'visibility'],
  },
  custom: {
    label: 'Custom',
    icon: 'settings',
    factors: ['temperature', 'rain', 'wind', 'timing'],
  },
};

export const CITIES: City[] = ['Madrid', 'Barcelona', 'Valencia', 'Seville'];

export const CITY_LOCATIONS: Record<City, string[]> = {
  Madrid: ['Retiro Park', 'Casa de Campo', 'Madrid Río', 'El Capricho'],
  Barcelona: ['Barceloneta Beach', 'Park Güell', 'Montjuïc', 'Ciutadella Park'],
  Valencia: ['Turia Gardens', 'Malvarrosa Beach', 'Albufera', 'City of Arts'],
  Seville: ['María Luisa Park', 'Alamillo Park', 'Triana Bridge', 'Plaza de España'],
};
