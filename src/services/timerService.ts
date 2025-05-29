import { io, Socket } from 'socket.io-client';
import type {
  AddTimeDto,
  ClientToServerEvents,
  CreateTimerDto,
  DonationMetadata,
  DonationType,
  LoadStateDto,
  SaveStateDto,
  ServerToClientEvents,
  TimerCommandDto,
  TimerState,
  TimerType
} from '../types/timer.types';

// Usar una variable de entorno o un valor por defecto
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Donation {
  type: 'BITS' | 'RAID' | 'SUBSCRIPTION';
  minutesAdded: number;
  bits?: number;
  viewers?: number;
  username: string;
}

class TimerService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private timerKey: string = 'test-key';
  private timerName: string = 'main-timer';

  constructor(timerKey: string = 'test-key', timerName: string = 'main-timer') {
    this.timerKey = timerKey;
    this.timerName = timerName;
  }

  setTimerInfo(timerKey: string, timerName: string) {
    this.timerKey = timerKey;
    this.timerName = timerName;
  }

  connect() {
    console.log('🔄 Conectando a Socket.IO en:', BASE_URL);
    this.socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      autoConnect: true,
      withCredentials: true,
      path: '/ws'
    });

    // Logs de eventos de conexión
    this.socket.on('connect', () => {
      console.log('✅ Socket.IO conectado');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Error de conexión Socket.IO:', error);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket.IO desconectado:', reason);
    });

    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      console.log('🔄 Socket.IO intentando reconexión:', attempt);
    });

    this.socket.io.on('reconnect_error', (error: Error) => {
      console.error('❌ Error de reconexión Socket.IO:', error);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('❌ Falló la reconexión Socket.IO después de todos los intentos');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Desconectando Socket.IO');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Métodos HTTP
  createTimer(type: TimerType, initialTime?: number) {
    const dto: CreateTimerDto = {
      timerKey: this.timerKey,
      timerName: this.timerName,
      type,
      initialTime
    };

    console.log('🆕 Creando temporizador (HTTP):', dto);
    return fetch(`${BASE_URL}/timer/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }

  startTimerHttp() {
    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('▶️ Iniciando temporizador (HTTP)');
    return fetch(`${BASE_URL}/timer/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }

  stopTimerHttp() {
    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('⏹️ Deteniendo temporizador (HTTP)');
    return fetch(`${BASE_URL}/timer/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }

  pauseTimerHttp() {
    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('⏸️ Pausando temporizador (HTTP)');
    return fetch(`${BASE_URL}/timer/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }

  resumeTimerHttp() {
    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('▶️ Reanudando temporizador (HTTP)');
    return fetch(`${BASE_URL}/timer/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }

  addTimeHttp(minutes: number, type: DonationType, metadata: DonationMetadata) {
    const dto: AddTimeDto = {
      timerKey: this.timerKey,
      timerName: this.timerName,
      minutes,
      type,
      metadata
    };

    console.log('⏱️ Añadiendo tiempo (HTTP):', dto);
    return fetch(`${BASE_URL}/timer/add-time`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
  }

  getTimerStateHttp() {
    console.log('📊 Obteniendo estado del temporizador (HTTP)');
    return fetch(`${BASE_URL}/timer/state/${this.timerKey}/${this.timerName}`);
  }

  getDonationsHttp() {
    console.log('💰 Obteniendo donaciones (HTTP)');
    return fetch(`${BASE_URL}/timer/donations/${this.timerKey}/${this.timerName}`);
  }

  // Métodos Socket
  createTimerSocket(type: TimerType, initialTime?: number) {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para crear el temporizador');
      return;
    }

    const dto: CreateTimerDto = {
      timerKey: this.timerKey,
      timerName: this.timerName,
      type,
      initialTime
    };

    console.log('🆕 Creando temporizador (Socket):', dto);
    this.socket.emit('create_timer', dto);
  }

  startTimerSocket() {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para iniciar el temporizador');
      return;
    }

    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('▶️ Iniciando temporizador (Socket)');
    this.socket.emit('start_timer', dto);
  }

  stopTimerSocket() {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para detener el temporizador');
      return;
    }

    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('⏹️ Deteniendo temporizador (Socket)');
    this.socket.emit('stop_timer', dto);
  }

  pauseTimerSocket() {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para pausar el temporizador');
      return;
    }

    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('⏸️ Pausando temporizador (Socket)');
    this.socket.emit('pause_timer', dto);
  }

  resumeTimerSocket() {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para reanudar el temporizador');
      return;
    }

    const dto: TimerCommandDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('▶️ Reanudando temporizador (Socket)');
    this.socket.emit('resume_timer', dto);
  }

  addTimeSocket(minutes: number, type: DonationType, metadata: DonationMetadata) {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para añadir tiempo');
      return;
    }

    const dto: AddTimeDto = {
      timerKey: this.timerKey,
      timerName: this.timerName,
      minutes,
      type,
      metadata
    };

    console.log('⏱️ Añadiendo tiempo (Socket):', dto);
    this.socket.emit('add_time', dto);
  }

  saveStateSocket(name: string, description?: string) {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para guardar estado');
      return;
    }

    const dto: SaveStateDto = {
      timerKey: this.timerKey,
      name,
      description
    };

    console.log('💾 Guardando estado (Socket):', dto);
    this.socket.emit('save_state', dto);
  }

  loadStateSocket() {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para cargar estado');
      return;
    }

    const dto: LoadStateDto = {
      timerKey: this.timerKey,
      timerName: this.timerName
    };

    console.log('📂 Cargando estado (Socket)');
    this.socket.emit('load_state', dto);
  }

  getSavedStatesSocket() {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para obtener estados guardados');
      return;
    }

    console.log('📋 Obteniendo estados guardados (Socket)');
    this.socket.emit('get_saved_states', { timerKey: this.timerKey });
  }

  subscribeToTimer(callback: (state: TimerState) => void) {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para suscribirse a eventos del temporizador');
      return;
    }

    console.log('📡 Suscribiéndose a eventos del temporizador');
    this.socket.on('timer.state', callback);
  }

  unsubscribeFromTimer(callback: (state: TimerState) => void) {
    if (!this.socket) return;

    console.log('📡 Desuscribiéndose de eventos del temporizador');
    this.socket.off('timer.state', callback);
  }

  subscribeToConnection(callback: (connected: boolean) => void) {
    if (!this.socket) {
      console.warn('⚠️ No hay conexión Socket.IO para suscribirse a eventos de conexión');
      return;
    }

    console.log('📡 Suscribiéndose a eventos de conexión');
    this.socket.on('connect', () => {
      console.log('✅ Evento connect recibido');
      callback(true);
    });
    this.socket.on('disconnect', () => {
      console.log('🔌 Evento disconnect recibido');
      callback(false);
    });
  }

  unsubscribeFromConnection(callback: (connected: boolean) => void) {
    if (!this.socket) return;

    console.log('📡 Desuscribiéndose de eventos de conexión');
    this.socket.off('connect', () => callback(true));
    this.socket.off('disconnect', () => callback(false));
  }
}

export const timerService = new TimerService();
