export type TimerType = 'COUNTDOWN' | 'COUNTUP';
export type TimerStatus = 'RUNNING' | 'PAUSED' | 'STOPPED';
export type DonationType = 'BITS' | 'RAID' | 'SUBSCRIPTION';

export interface TimerState {
  timerKey: string;
  timerName?: string;
  currentTime: number;
  status: TimerStatus;
  type: TimerType;
  targetMinutes?: number;
  formattedTime?: string;
  lastUpdated: string;
}

export interface SavedTimerState {
  stateId: string;
  timerName: string;
  type: TimerType;
  currentTime: number;
  status: TimerStatus;
  lastUpdated: string;
  name?: string;
  description?: string;
}

export interface DonationMetadata {
  username: string;
  message?: string;
  emotes?: string[];
  bits?: number;
  viewers?: number;
}

export interface CreateTimerDto {
  timerKey: string;
  timerName?: string;
  type?: TimerType;
  initialTime?: number;
}

export interface AddTimeDto {
  timerKey: string;
  timerName?: string;
  minutes: number;
  type: DonationType;
  metadata: DonationMetadata;
}

export interface SaveStateDto {
  timerKey: string;
  name: string;
  description?: string;
}

export interface LoadStateDto {
  timerKey: string;
  stateId?: string;
}

export interface TimerCommandDto {
  timerKey: string;
  timerName?: string;
}

export interface TwitchNotificationDto {
  type: 'bits' | 'subscription' | 'raid';
  timerKey: string;
  timerName?: string;
  username: string;
  metadata: DonationMetadata;
}

export interface TimerError {
  code: string;
  message: string;
  details?: any;
}

// WebSocket Events
export interface WebSocketEvents {
  // Client to Server
  'create_timer': CreateTimerDto;
  'start_timer': TimerCommandDto;
  'stop_timer': TimerCommandDto;
  'pause_timer': TimerCommandDto;
  'resume_timer': TimerCommandDto;
  'save_state': SaveStateDto;
  'load_state': LoadStateDto;
  'get_saved_states': { timerKey: string; };
  'add_time': AddTimeDto;
  'get_time': TimerCommandDto;
  'get_timer_state': TimerCommandDto;
  'get_all_timers': { timerKey: string; };

  // Server to Client
  'timer.state': TimerState;
  'timer.state_saved': SavedTimerState;
  'timer.saved_states': SavedTimerState[];
  'timer.error': TimerError;
}

// Socket.IO Event Types
export interface ServerToClientEvents {
  'timer.state': (state: TimerState) => void;
  'timer.update': (time: { currentTime: number; }) => void;
  'timer.state_saved': (state: SavedTimerState) => void;
  'timer.saved_states': (states: SavedTimerState[]) => void;
  'timer.error': (error: TimerError) => void;
  [key: string]: (...args: any[]) => void; // Para eventos dinámicos
}

export interface ClientToServerEvents {
  'create_timer': (dto: CreateTimerDto) => void;
  'start_timer': (dto: TimerCommandDto) => void;
  'stop_timer': (dto: TimerCommandDto) => void;
  'pause_timer': (dto: TimerCommandDto) => void;
  'resume_timer': (dto: TimerCommandDto) => void;
  'save_state': (dto: SaveStateDto) => void;
  'load_state': (dto: LoadStateDto) => void;
  'get_saved_states': (dto: { timerKey: string; }) => void;
  'add_time': (dto: AddTimeDto) => void;
  'get_time': (dto: TimerCommandDto) => void;
  'get_timer_state': (dto: TimerCommandDto) => void;
  'get_all_timers': (dto: { timerKey: string; }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  timerKey: string;
  timerName: string;
}

export type TimerEventType =
  | 'TIMER_CREATED'
  | 'TIMER_STARTED'
  | 'TIMER_STOPPED'
  | 'TIMER_PAUSED'
  | 'TIMER_RESUMED'
  | 'TIMER_RESET'
  | 'TIMER_UPDATED'
  | 'TIMER_ERROR'
  | 'TIMER_STATE_SAVED'
  | 'TIMER_STATE_LOADED'
  | 'TIMER_STATES_LOADED'
  | 'TIMER_TIME_ADDED';
