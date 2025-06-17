import { type Socket, io } from "socket.io-client";
import type {
  AddTimeDto,
  ClientToServerEvents,
  CreateTimerDto,
  DonationMetadata,
  DonationType,
  LoadStateDto,
  SaveStateDto,
  SavedTimerState,
  ServerToClientEvents,
  TimerCommandDto,
  TimerError,
  TimerState,
  TimerType,
} from "../types/timer.types";

// Usar una variable de entorno o un valor por defecto
const BASE_URL =
  import.meta.env.VITE_API_URL?.replace("ws://", "http://") ||
  "http://localhost:3000";
const DEFAULT_TIMER_KEY =
  import.meta.env.VITE_DEFAULT_TIMER_KEY || "main-timer";
const DEFAULT_TIMER_TYPE = (import.meta.env.VITE_DEFAULT_TIMER_TYPE ||
  "COUNTDOWN") as TimerType;
const DEFAULT_INITIAL_TIME =
  Number(import.meta.env.VITE_DEFAULT_INITIAL_TIME) || 60 * 60; // 60 minutos por defecto

// Agregar constantes para la conexión
const RECONNECT_DELAY = 1000; // 1 segundo
const MAX_RECONNECT_DELAY = 30000; // 30 segundos
const CONNECTION_TIMEOUT = 5000; // 5 segundos

export interface Donation {
  type: DonationType;
  minutesAdded: number;
  bits?: number;
  viewers?: number;
  username: string;
  message?: string;
  emotes?: string[];
  timestamp: string;
  timerKey: string;
  timerName?: string;
}

class TimerService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;
  private timerKey: string = DEFAULT_TIMER_KEY;
  private timerName: string = this.generateFriendlyName(
    DEFAULT_TIMER_KEY,
    DEFAULT_TIMER_TYPE,
  );
  private errorCallbacks: ((error: TimerError) => void)[] = [];
  private connectionCallbacks: ((connected: boolean) => void)[] = [];
  private timerCallbacks: ((state: TimerState) => void)[] = [];
  private savedStatesCallbacks: ((states: SavedTimerState[]) => void)[] = [];
  private isConnecting = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private operationQueue: Array<() => Promise<void>> = [];
  private maxReconnectAttempts = 5;
  private currentReconnectAttempt = 0;
  private lastTimerState: TimerState | null = null;
  private timerState: TimerState = {
    currentTime: 0,
    type: "COUNTDOWN",
    status: "STOPPED",
    lastUpdated: new Date().toISOString(),
    timerKey: DEFAULT_TIMER_KEY,
  };

  constructor(timerKey: string = DEFAULT_TIMER_KEY, timerName?: string) {
    this.timerKey = timerKey;
    this.timerName =
      timerName || this.generateFriendlyName(timerKey, DEFAULT_TIMER_TYPE);
  }

  // Función para generar un nombre amigable a partir de la clave
  generateFriendlyName(
    key: string,
    type: TimerType = DEFAULT_TIMER_TYPE,
  ): string {
    // Limpiar la clave y convertir a palabras
    const words = key
      .replace(/[_-]/g, " ") // Reemplazar guiones y guiones bajos por espacios
      .replace(/[^a-zA-Z0-9\s]/g, "") // Eliminar caracteres especiales
      .split(/\s+/) // Dividir por espacios
      .filter((word) => word.length > 0) // Eliminar palabras vacías
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      ); // Capitalizar

    // Si no hay palabras válidas, usar un nombre por defecto
    if (words.length === 0) {
      return type === "COUNTDOWN" ? "Cuenta Regresiva" : "Cuenta Ascendente";
    }

    // Agregar prefijo basado en el tipo
    const prefix = type === "COUNTDOWN" ? "Timer" : "Contador";

    // Unir las palabras y agregar el prefijo
    return `${prefix} ${words.join(" ")}`;
  }

  setTimerInfo(timerKey: string, timerName?: string) {
    this.timerKey = timerKey;
    this.timerName =
      timerName || this.generateFriendlyName(timerKey, DEFAULT_TIMER_TYPE);
  }

  private handleConnectionError = (error: Error) => {
    console.error("Error de conexión:", error);
    for (const connectionCallbacks of this.connectionCallbacks) {
      connectionCallbacks(false);
    }
    for (const errorCallbacks of this.errorCallbacks) {
      errorCallbacks({
        message: `Error de conexión: ${error.message}`,
        code: "CONNECTION_ERROR",
      });
    }

    // Incrementar el contador de intentos de reconexión
    this.currentReconnectAttempt++;

    // Si no hemos excedido el número máximo de intentos, programar una reconexión
    if (this.currentReconnectAttempt <= this.maxReconnectAttempts) {
      const delay = Math.min(1000 * 2 ** this.currentReconnectAttempt, 30000); // Backoff exponencial con máximo de 30 segundos
      this.scheduleReconnect(delay);
    } else {
      console.error("❌ Se alcanzó el número máximo de intentos de reconexión");
      for (const errorCallbacks of this.errorCallbacks) {
        errorCallbacks({
          message: "No se pudo establecer conexión después de varios intentos",
          code: "MAX_RECONNECT_ATTEMPTS",
        });
      }
    }
  };

  private scheduleReconnect(delay = 5000) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectTimeout = setTimeout(async () => {
      const connected = await this.ensureConnection();
      if (!connected) {
        this.processQueue();
      }
    }, delay);
  }
  public async ensureConnection(): Promise<boolean> {
    if (this.isConnecting) {
      return false;
    }

    if (this.socket?.connected) {
      return true;
    }
    this.isConnecting = true;
    try {
      await this.connect();
      this.currentReconnectAttempt = 0; // Resetear el contador de intentos al conectar exitosamente
      console.log("✅ Conexión establecida exitosamente");
      return true;
    } catch (error) {
      console.error("❌ Error al intentar conectar:", error);
      this.handleConnectionError(
        error instanceof Error
          ? error
          : new Error("Error desconocido al conectar"),
      );
      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private async processQueue() {
    if (!this.socket?.connected) {
      console.log("⚠️ No hay conexión, no se puede procesar la cola");
      return;
    }

    if (this.operationQueue.length === 0) {
      console.log("✅ Cola de operaciones vacía");
      return;
    }

    console.log(
      `🔄 Procesando cola de operaciones (${this.operationQueue.length} pendientes)...`,
    );

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      if (operation) {
        try {
          console.log("▶️ Ejecutando operación pendiente...");
          await operation();
          console.log("✅ Operación completada exitosamente");
        } catch (error) {
          console.error("❌ Error al procesar operación:", error);
          // Reinsertar la operación al principio de la cola
          this.operationQueue.unshift(operation);
          console.log("⚠️ Operación reinsertada en la cola");
          break;
        }
      }
    }
  }

  private queueOperation(operation: () => Promise<void>) {
    console.log("📝 Encolando nueva operación...");
    this.operationQueue.push(operation);

    // Intentar procesar la cola inmediatamente si hay conexión
    if (this.socket?.connected) {
      this.processQueue();
    } else {
      console.log("⚠️ No hay conexión, operación encolada para más tarde");
    }
  }

  private validateTimerState(state: TimerState): boolean {
    if (!state || typeof state !== "object") {
      console.error("Estado del timer inválido:", state);
      return false;
    }

    if (
      typeof state.currentTime !== "number" ||
      Number.isNaN(state.currentTime)
    ) {
      console.error("Tiempo actual inválido:", state.currentTime);
      return false;
    }

    if (!["COUNTDOWN", "COUNTUP"].includes(state.type)) {
      console.error("Tipo de timer inválido:", state.type);
      return false;
    }

    if (!["RUNNING", "PAUSED", "STOPPED"].includes(state.status)) {
      console.error("Estado inválido:", state.status);
      return false;
    }

    return true;
  }

  private handleTimerStateUpdate = (data: TimerState) => {
    try {
      // Validar el estado recibido
      if (!this.validateTimerState(data)) {
        throw new Error("Estado del timer inválido");
      }

      // Actualizar el estado local solo si el nuevo estado es más reciente
      const currentLastUpdated = this.timerState.lastUpdated
        ? new Date(this.timerState.lastUpdated).getTime()
        : 0;
      const newLastUpdated = new Date(data.lastUpdated).getTime();

      console.log("📊 [Timer State] Estado recibido:", {
        currentTime: data.currentTime,
        type: data.type,
        status: data.status,
        timerKey: data.timerKey,
        lastUpdated: data.lastUpdated,
        hasCondition: newLastUpdated >= currentLastUpdated,
      });

      if (newLastUpdated >= currentLastUpdated) {
        // REMOVER esta lógica problemática que mantiene el tiempo anterior
        // const shouldKeepCurrentTime =
        //   data.status === "PAUSED" && this.timerState.status === "RUNNING";
        // const newCurrentTime = shouldKeepCurrentTime
        //   ? this.timerState.currentTime
        //   : data.currentTime;

        // Usar directamente el tiempo que viene del servidor
        this.timerState = {
          ...data, // Usar todo el estado que viene del servidor
          timerKey: data.timerKey || this.timerKey, // Asegurar que el timerKey esté presente
        };

        // Guardar el último estado válido
        this.lastTimerState = this.timerState;

        // Notificar a los suscriptores
        try {
          console.log(
            "🔔 [Timer State] Notificando a",
            this.timerCallbacks.length,
            "callbacks",
          );
          for (const timerCallback of this.timerCallbacks) {
            timerCallback(this.timerState);
          }
        } catch (error) {
          console.error("❌ [Timer State] Error en callback:", error);
        }
      } else {
        console.log("⚠️ [Timer State] Ignorando estado anterior:", {
          current: currentLastUpdated,
          new: newLastUpdated,
        });
      }
    } catch (error) {
      console.error("❌ [Timer State] Error al procesar estado:", error);
      for (const errorCallback of this.errorCallbacks) {
        errorCallback({
          message:
            error instanceof Error
              ? error.message
              : "Error al procesar estado del timer",
          code: "TIMER_STATE_ERROR",
        });
      }
    }
  };

  connect() {
    console.log("🔄 Iniciando conexión Socket.IO a:", BASE_URL);

    // Limpiar socket existente si hay uno
    if (this.socket) {
      console.log("🧹 Limpiando conexión Socket.IO existente");
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(`${BASE_URL}/timer`, {
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: MAX_RECONNECT_DELAY,
      timeout: CONNECTION_TIMEOUT,
      autoConnect: true,
      transports: ["websocket", "polling"],
      forceNew: true,
      path: "/socket.io",
      withCredentials: true,
      extraHeaders: {
        "Access-Control-Allow-Origin": "*",
      },
    });

    // Agregar listeners para diagnóstico
    this.socket.io.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 Intento de reconexión #${attempt}`);
    });

    this.socket.io.on("reconnect", (attempt) => {
      console.log(`✅ Reconectado después de ${attempt} intentos`);
    });

    this.socket.io.on("reconnect_error", (error) => {
      console.error("❌ Error en reconexión:", error);
    });

    this.socket.io.on("reconnect_failed", () => {
      console.error("❌ Falló la reconexión después de todos los intentos");
    });

    // this.socket.io.on('ping', () => {
    //   console.log('📡 Ping enviado');
    // });

    this.socket.on("connect", () => {
      console.log("✅ Conectado a Socket.IO");
      this.isConnecting = false;
      this.currentReconnectAttempt = 0;
      for (const connectionCallback of this.connectionCallbacks) {
        connectionCallback(true);
      }
      this.restoreSubscriptions();
      this.processQueue();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Desconectado de Socket.IO. Razón:", reason);
      for (const connectionCallback of this.connectionCallbacks) {
        connectionCallback(false);
      }
      if (reason !== "io client disconnect") {
        this.scheduleReconnect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Error de conexión Socket.IO:", error.message);
      console.error("Detalles del error:", error);
      console.error("Stack trace:", error.stack);
      this.handleConnectionError(new Error(error.message));
    });

    this.socket.on("error", (error) => {
      console.error("❌ Error general de Socket.IO:", error);
      this.handleConnectionError(new Error("Error general de Socket.IO"));
    });

    this.socket.on(
      "timer.update",
      (data: { currentTime: number } | TimerState) => {
        console.log("⏱️ [Socket] Evento timer.update recibido:", data);

        // Si es solo un update de tiempo
        if (
          "currentTime" in data &&
          typeof data.currentTime === "number" &&
          this.lastTimerState
        ) {
          const updatedState: TimerState = {
            ...this.lastTimerState,
            currentTime: data.currentTime,
            lastUpdated: new Date().toISOString(),
          };
          this.handleTimerStateUpdate(updatedState);
        }
        // Si es un estado completo
        else if (this.validateTimerState(data as TimerState)) {
          this.handleTimerStateUpdate(data as TimerState);
        }
      },
    );

    this.socket.on(
      "timer.state",
      (state: TimerState | { data: TimerState }) => {
        console.log("📊 [Socket] Evento timer.state recibido:", state);

        // Si viene con .data, desestructurar
        const parsedState =
          "data" in state && state.data ? state.data : (state as TimerState);

        if (!this.validateTimerState(parsedState)) {
          console.error("❌ [Socket] Estado del timer inválido:", parsedState);
          return;
        }

        this.handleTimerStateUpdate(parsedState);
      },
    );

    // Escuchar eventos de tiempo específicos para este timer
    const specificTimerEvent = `timer.${this.timerKey}.${this.timerName}.time`;
    console.log(
      "🎯 [Socket] Suscrito a evento específico:",
      specificTimerEvent,
    );
    this.socket.on(
      specificTimerEvent,
      (time: { currentTime: number; formattedTime: string }) => {
        console.log("⏱️ [Socket] Evento específico recibido:", time);
        if (
          time &&
          typeof time.currentTime === "number" &&
          this.lastTimerState
        ) {
          const updatedState: TimerState = {
            ...this.lastTimerState,
            currentTime: time.currentTime,
            lastUpdated: new Date().toISOString(),
          };
          this.handleTimerStateUpdate(updatedState);
        }
      },
    );

    // Escuchar eventos de estados guardados
    this.socket.on("timer.state_saved", (state: SavedTimerState) => {
      console.log("💾 Estado guardado:", state);
      for (const savedStatesCallbacks of this.savedStatesCallbacks) {
        savedStatesCallbacks([state]);
      }
    });

    this.socket.on("timer.saved_states", (states: SavedTimerState[]) => {
      console.log("📚 Estados guardados recibidos:", states);
      for (const savedStatesCallbacks of this.savedStatesCallbacks) {
        savedStatesCallbacks(states);
      }
    });

    return this.socket;
  }

  private restoreSubscriptions() {
    if (!this.socket) return;

    console.log("🔄 Restaurando suscripciones...");

    // NO agregar listeners duplicados aquí, ya están en connect()
    // Los callbacks ya se ejecutarán cuando lleguen los eventos

    // Si hay un estado guardado, notificar a los callbacks
    if (this.lastTimerState) {
      console.log("📤 Notificando estado guardado a callbacks");
      for (const callback of this.timerCallbacks) {
        try {
          callback(this.lastTimerState);
        } catch (error) {
          console.error("❌ Error en callback de restauración:", error);
        }
      }
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.operationQueue = [];
    this.currentReconnectAttempt = 0;
    this.lastTimerState = null;
    if (this.socket) {
      console.log("🔌 Desconectando Socket.IO");
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Métodos HTTP
  async createTimerHttp(type: TimerType, initialTime?: number) {
    const dto: CreateTimerDto = {
      timerKey: this.timerKey,
      timerName: this.timerName,
      type,
      initialTime,
    };

    console.log("🆕 Creando temporizador (HTTP):", dto);
    const response = await fetch(`${BASE_URL}/timer/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });
    return response.json();
  }

  public async getTimerStateHttp(): Promise<TimerState | undefined> {
    try {
      console.log("📊 Obteniendo estado del temporizador (HTTP)");
      const response = await fetch(`${BASE_URL}/timer/state/${this.timerKey}`);

      if (!response.ok) {
        // Si el timer no existe, devolvemos undefined
        if (response.status === 404) {
          console.warn("Timer no encontrado en el servidor (HTTP)");
          return undefined;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as TimerState;
      return data;
    } catch (error) {
      console.error("Error al obtener el estado del timer (HTTP):", error);
      return undefined;
    }
  }

  async getDonationsHttp() {
    console.log("💰 Obteniendo donaciones (HTTP)");
    const response = await fetch(
      `${BASE_URL}/timer/donations/${this.timerKey}`,
    );
    return response.json();
  }

  async getSavedStatesHttp() {
    console.log("💾 Obteniendo estados guardados (HTTP)");
    const response = await fetch(
      `${BASE_URL}/timer/saved-states?timerKey=${this.timerKey}`,
    );
    return response.json();
  }

  async resetTimerHttp(): Promise<TimerState> {
    try {
      const response = await fetch(`${BASE_URL}/timer/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timerKey: this.timerKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al restablecer el timer");
      }

      return await response.json();
    } catch (error) {
      console.error("Error al restablecer el timer:", error);
      throw error;
    }
  }

  async pauseTimerHttp(): Promise<TimerState> {
    try {
      const response = await fetch(`${BASE_URL}/timer/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timerKey: this.timerKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al pausar el timer");
      }

      return await response.json();
    } catch (error) {
      console.error("Error al pausar el timer:", error);
      throw error;
    }
  }

  async resumeTimerHttp(): Promise<TimerState> {
    try {
      const response = await fetch(`${BASE_URL}/timer/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timerKey: this.timerKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al reanudar el timer");
      }

      return await response.json();
    } catch (error) {
      console.error("Error al reanudar el timer:", error);
      throw error;
    }
  }

  async startTimerHttp(): Promise<TimerState> {
    try {
      const response = await fetch(`${BASE_URL}/timer/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timerKey: this.timerKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al iniciar el timer");
      }

      return await response.json();
    } catch (error) {
      console.error("Error al iniciar el timer:", error);
      throw error;
    }
  }

  // Métodos Socket
  createTimerSocket(type: TimerType, initialTime?: number) {
    if (!this.socket) {
      console.warn("⚠️ No hay conexión Socket.IO para crear el temporizador");
      return;
    }

    const dto: CreateTimerDto = {
      timerKey: this.timerKey,
      timerName: this.timerName,
      type,
      initialTime,
    };

    console.log("🆕 Creando temporizador (Socket):", dto);
    this.socket.emit("create_timer", dto);
  }

  public startTimerSocket = () => {
    console.log("▶️ [Socket] Intentando iniciar temporizador:", {
      timerKey: this.timerKey,
      timerName: this.timerName,
    });
    console.log("🔌 [Socket] Estado de conexión:", this.socket?.connected);
    console.log("📡 ID del socket:", this.socket?.id);

    if (!this.socket?.connected) {
      console.error("❌ [Socket] No hay conexión activa");
      return;
    }

    // Emitir el evento de inicio
    this.socket.emit("start_timer", {
      timerKey: this.timerKey,
      timerName: this.timerName,
    });

    // Solicitar el estado actual del timer
    this.getTimerStateSocket();
  };

  async pauseTimerSocket() {
    const operation = async () => {
      const dto: TimerCommandDto = {
        timerKey: this.timerKey,
        timerName: this.timerName,
      };
      console.log("⏸️ Pausando temporizador (Socket):", dto);
      this.socket?.emit("pause_timer", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para pausar el temporizador, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  async resumeTimerSocket() {
    const operation = async () => {
      const dto: TimerCommandDto = {
        timerKey: this.timerKey,
        timerName: this.timerName,
      };
      console.log("▶️ Reanudando temporizador (Socket):", dto);
      this.socket?.emit("resume_timer", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para reanudar el temporizador, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  async resetTimerSocket() {
    const operation = async () => {
      const dto: TimerCommandDto = {
        timerKey: this.timerKey,
        timerName: this.timerName,
      };
      console.log("▶️ Reestableciendo temporizador (Socket):", dto);
      this.socket?.emit("reset_timer", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para restablecer el temporizador, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  async addTimeSocket(
    minutes: number,
    type: DonationType,
    metadata: DonationMetadata,
  ) {
    const operation = async () => {
      const dto: AddTimeDto = {
        timerKey: this.timerKey,
        timerName: this.timerName,
        minutes,
        type,
        metadata,
      };
      console.log("⏱️ Añadiendo tiempo (Socket):", dto);
      this.socket?.emit("add_time", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para añadir tiempo, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  async saveStateSocket(name: string, description?: string): Promise<void> {
    if (!name?.trim()) {
      throw new Error("El nombre del estado no puede estar vacío");
    }

    const operation = async () => {
      const dto: SaveStateDto = {
        timerKey: this.timerKey,
        name,
        description,
      };
      console.log("💾 Guardando estado (Socket):", dto);
      this.socket?.emit("save_state", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para guardar estado, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  async loadStateSocket(stateId?: string): Promise<void> {
    const operation = async () => {
      const dto: LoadStateDto = {
        timerKey: this.timerKey,
        stateId,
      };
      console.log("📂 Cargando estado (Socket):", dto);
      this.socket?.emit("load_state", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para cargar estado, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  async getSavedStatesSocket(): Promise<SavedTimerState[]> {
    const operation = async () => {
      const dto = { timerKey: this.timerKey };
      console.log("📚 Obteniendo estados guardados (Socket)");
      this.socket?.emit("get_saved_states", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para obtener estados guardados, encolando operación...",
      );
      this.queueOperation(operation);
      return [];
    }

    await operation();
    return []; // Los estados vendrán por el evento 'timer.saved_states'
  }

  async getTimerStateSocket(): Promise<void> {
    const operation = async () => {
      const dto: TimerCommandDto = {
        timerKey: this.timerKey,
        timerName: this.timerName,
      };
      console.log("📊 Obteniendo estado del temporizador (Socket)");
      this.socket?.emit("get_timer_state", dto);
    };

    if (!(await this.ensureConnection())) {
      console.warn(
        "⚠️ No hay conexión Socket.IO para obtener estado del temporizador, encolando operación...",
      );
      this.queueOperation(operation);
      return;
    }

    await operation();
  }

  subscribeToTimerUpdate(callback: (state: TimerState) => void) {
    console.log("📝 Suscribiendo a actualizaciones del timer");
    this.timerCallbacks.push(callback);

    // Si hay un estado actual, notificar inmediatamente
    if (this.lastTimerState) {
      console.log("📤 Notificando estado actual al nuevo suscriptor");
      try {
        callback(this.lastTimerState);
      } catch (error) {
        console.error("❌ Error en callback inmediato:", error);
      }
    }
  }

  // Suscripciones
  unsubscribeToTimerUpdate(callback: (state: TimerState) => void) {
    this.timerCallbacks = this.timerCallbacks.filter((cb) => cb !== callback);
    if (this.socket) {
      this.socket.off("timer.update", callback);
    }
  }

  subscribeToTimerState(callback: (state: TimerState) => void) {
    console.log("📝 Suscribiendo a estado del timer");
    this.timerCallbacks.push(callback);

    // Si hay un estado actual, notificar inmediatamente
    if (this.lastTimerState) {
      console.log("📤 Notificando estado actual al nuevo suscriptor");
      try {
        callback(this.lastTimerState);
      } catch (error) {
        console.error("❌ Error en callback inmediato:", error);
      }
    }
  }

  unsubscribeFromTimerState(callback: (state: TimerState) => void) {
    this.timerCallbacks = this.timerCallbacks.filter((cb) => cb !== callback);
    if (this.socket) {
      this.socket.off("timer.state", callback);
    }
  }

  subscribeToSavedStates(callback: (states: SavedTimerState[]) => void) {
    this.savedStatesCallbacks.push(callback);
    if (this.socket?.connected) {
      this.socket.on("timer.saved_states", callback);
    }
  }

  unsubscribeFromSavedStates(callback: (states: SavedTimerState[]) => void) {
    this.savedStatesCallbacks = this.savedStatesCallbacks.filter(
      (cb) => cb !== callback,
    );
    if (this.socket) {
      this.socket.off("timer.saved_states", callback);
    }
  }

  subscribeToError(callback: (error: TimerError) => void) {
    this.errorCallbacks.push(callback);
  }

  unsubscribeFromError(callback: (error: TimerError) => void) {
    this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback);
  }

  subscribeToConnection(callback: (connected: boolean) => void) {
    this.connectionCallbacks.push(callback);
    if (this.socket) {
      callback(this.socket.connected);
    }
  }

  unsubscribeFromConnection(callback: (connected: boolean) => void) {
    this.connectionCallbacks = this.connectionCallbacks.filter(
      (cb) => cb !== callback,
    );
  }

  async checkTimerExists(): Promise<TimerState | undefined> {
    try {
      const response = await fetch(`${BASE_URL}/timer/state/${this.timerKey}`);
      if (response.status === 404) {
        // Si el timer no existe, lo creamos con los valores por defecto
        console.log(
          "Timer no existe, creando uno nuevo con valores por defecto...",
        );
        if (this.socket) {
          this.createTimerSocket(DEFAULT_TIMER_TYPE, DEFAULT_INITIAL_TIME);
        } else {
          await this.createTimerHttp(DEFAULT_TIMER_TYPE, DEFAULT_INITIAL_TIME);
        }
        return undefined;
      }
      const data = (await response.json()) as TimerState;
      return data && typeof data.currentTime === "number" ? data : undefined;
    } catch (error) {
      console.error("Error al verificar si existe el timer:", error);
      return undefined;
    }
  }
}

export default TimerService;
