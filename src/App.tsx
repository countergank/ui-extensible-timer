import { ButtonPanel, type PanelButton } from "@/components/ButtonPanel";
import ThemeSelector from "@/components/ThemeSelector";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { formatTime } from "@/lib/formatTime";
import {
  ClockPlus,
  Gift,
  Hash,
  Pause,
  Play,
  Save,
  Server,
  Shuffle,
  Timer,
  TimerReset,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import "./App.css";
import { CreateTimerModal } from "./components/CreateTimerModal";
import { FloatingTimer } from "./components/FloatingTimer";
import { ThemeProvider } from "./context/ThemeContext";
import TimerService from "./services/timerService";
import type {
  DonationType,
  TimerError,
  TimerState,
  TimerType,
} from "./types/timer.types";

function AppContent() {
  const [socket, setSocket] = useState<Socket | null>(null);

  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [useSocket, setUseSocket] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [currentTimerKey, setCurrentTimerKey] = useState<string>("main-timer");
  const [currentTimerName, setCurrentTimerName] =
    useState<string>("Main Timer");
  const [currentTimerType, setCurrentTimerType] =
    useState<TimerType>("COUNTDOWN");
  const [formattedTime, setFormattedTime] = useState<string>("00:00:00");
  const [error, setError] = useState<string | null>(null);

  // Crear una referencia al timerService para evitar recrearlo en cada render
  const timerServiceRef = useRef<TimerService | null>(null);

  // 1. Corregir handleTimerUpdate para no interferir con las actualizaciones
  const handleTimerUpdate = useCallback((data: TimerState) => {
    try {
      // Determinar el estado del timer basado en el status del servidor
      const status = data.status?.toUpperCase() || "STOPPED";
      const isActive = status === "RUNNING";
      const isPaused = status === "PAUSED";
      const isStopped = status === "STOPPED";
      const currentType = data.type;
      const currentFormattedType = data.formattedTime;

      // CORREGIR: Usar directamente el tiempo que viene del servidor
      // NO mantener el tiempo anterior cuando se pausa
      const currentTime =
        data.type === "COUNTDOWN"
          ? Math.max(0, data.currentTime || 0) // Para countdown, no permitir valores negativos
          : data.currentTime || 0; // Para countup, permitir cualquier valor

      // Actualizar el estado del timer
      setTimer(currentTime);
      setIsActive(isActive);
      setIsPaused(isPaused);
      setIsStopped(isStopped);
      setCurrentTimerType(currentType);
      setFormattedTime(currentFormattedType);
      setError(null); // Limpiar cualquier error previo

      // Si es countdown y llegó a 0, detener el timer
      if (data.type === "COUNTDOWN" && currentTime === 0 && isActive) {
        console.info("[TIMER] Countdown llegó a 0, pausando timer");
        if (timerServiceRef.current) {
          timerServiceRef.current.pauseTimerSocket();
        }
      }
    } catch (error) {
      console.error("[TIMER ERROR]", error);
      setError(
        error instanceof Error
          ? error.message
          : "Error al actualizar el temporizador",
      );
    }
  }, []);

  // Función para manejar errores con timeout
  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  // Función para cerrar el error manualmente
  const handleCloseError = () => {
    setError(null);
  };

  const handleConnectionChange = useCallback(
    async (connected: boolean) => {
      try {
        setIsConnected(connected);
        if (!connected) {
          handleError("Conexión perdida. Intentando reconectar...");
        } else {
          setError(null);
        }

        if (timerServiceRef.current) {
          // Verificar si el timer existe
          const state = await timerServiceRef.current?.checkTimerExists();
          if (state) {
            handleTimerUpdate(state);
          }

          if (!state) {
            // Usar variables de entorno con valores por defecto
            const defaultType = (import.meta.env.VITE_DEFAULT_TIMER_TYPE ||
              "COUNTDOWN") as TimerType;
            const defaultTime =
              Number(import.meta.env.VITE_DEFAULT_INITIAL_TIME) || 60 * 60;
            const defaultKey =
              import.meta.env.VITE_DEFAULT_TIMER_KEY || "main-timer";

            setCurrentTimerType(defaultType);
            setCurrentTimerKey(defaultKey);
            setCurrentTimerName(
              timerServiceRef.current?.generateFriendlyName(
                defaultKey,
                defaultType,
              ) || "",
            );
            setTimer(defaultTime);

            return timerServiceRef.current?.createTimerSocket(
              defaultType,
              defaultTime,
            );
          }
        }
      } catch {
        setError("Error al obtener el estado del timer");
        setTimer(0);
        setIsActive(false);
      }
    },
    [handleTimerUpdate, handleError],
  );

  // Efecto para inicializar el timerService
  useEffect(() => {
    // Solo crear el servicio si no existe
    if (!timerServiceRef.current) {
      timerServiceRef.current = new TimerService(
        currentTimerKey,
        currentTimerName,
      );
    } else {
      // Si ya existe, solo actualizar la información
      timerServiceRef.current.setTimerInfo(currentTimerKey, currentTimerName);
    }

    // Obtener el estado inicial del timer
    const initializeTimer = async () => {
      try {
        const state = await timerServiceRef.current?.getTimerStateHttp();
        if (state) {
          console.info("[INIT] Estado inicial obtenido:", state);
          handleTimerUpdate(state);
        } else {
          console.warn("[INIT] No se encontró estado inicial");
        }
      } catch (error) {
        console.error("[INIT] Error al obtener estado inicial:", error);
        setError("Error al obtener el estado inicial del timer");
      }
    };

    initializeTimer();

    return () => {
      console.info("[CLEANUP] Limpiando TimerService...");
      if (timerServiceRef.current) {
        timerServiceRef.current.disconnect();
        timerServiceRef.current = null;
      }
    };
  }, [currentTimerKey, currentTimerName, handleTimerUpdate]);

  useEffect(() => {
    if (!timerServiceRef.current) {
      console.warn("[CONNECTION] TimerService no disponible");
      return;
    }

    console.info("[CONNECTION] Configurando conexión y suscripciones...");
    const service = timerServiceRef.current;

    // Conectar
    const newSocket = service.connect();
    setSocket(newSocket);

    // Suscribirse a eventos UNA SOLA VEZ
    service.subscribeToTimer(handleTimerUpdate);
    service.subscribeToConnection(handleConnectionChange);
    service.subscribeToError((error: TimerError) => {
      handleError(error.message);
    });

    // Intentar reconexión si es necesario
    const attemptReconnect = async () => {
      if (!service.isConnected()) {
        console.info("🔄 Intentando reconexión...");
        await service.ensureConnection();
      }
    };

    // Intentar reconexión cada 5 segundos si no está conectado
    const reconnectInterval = setInterval(attemptReconnect, 5000);

    return () => {
      console.info("[CONNECTION CLEANUP] Limpiando suscripciones...");
      clearInterval(reconnectInterval);

      // Desuscribirse de todos los eventos
      service.unsubscribeToTimer(handleTimerUpdate);
      service.unsubscribeFromConnection(handleConnectionChange);
      service.unsubscribeFromError((error: TimerError) => {
        handleError(error.message);
      });
    };
  }, [handleConnectionChange, handleError, handleTimerUpdate]);

  // Efecto para manejar la reconexión cuando el socket se pierde
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => {
      console.error("❌ Socket desconectado, programando reconexión...");
      // No llamar ensureConnection aquí para evitar múltiples intentos
      // El intervalo de reconexión se encargará de esto
    };

    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleCreateTimer = (
    timerKey: string,
    timerName: string,
    type: TimerType,
    initialTime?: number,
  ) => {
    setCurrentTimerKey(timerKey);
    setCurrentTimerName(timerName);

    if (timerServiceRef.current) {
      timerServiceRef.current.setTimerInfo(timerKey, timerName);
      if (useSocket) {
        timerServiceRef.current.createTimerSocket(type, initialTime);
      } else {
        timerServiceRef.current.createTimerHttp(type, initialTime);
      }
    }
  };

  const handleStart = () => {
    if (timerServiceRef.current) {
      if (isPaused) {
        // Si está pausado, reanudar
        if (useSocket) {
          timerServiceRef.current.resumeTimerSocket();
        } else {
          timerServiceRef.current.resumeTimerHttp();
        }
      } else {
        // Si está detenido, iniciar
        if (useSocket) {
          timerServiceRef.current.startTimerSocket();
        } else {
          timerServiceRef.current.startTimerHttp();
        }
      }
    } else {
      setError("No hay conexión con el servidor");
    }
  };

  const handleReset = () => {
    if (timerServiceRef.current) {
      if (useSocket) {
        timerServiceRef.current.resetTimerSocket();
      } else {
        timerServiceRef.current.resetTimerHttp();
      }
    }
  };

  const handlePause = () => {
    if (isActive && !isPaused && !isStopped && timerServiceRef.current) {
      if (useSocket) {
        timerServiceRef.current.pauseTimerSocket();
      } else {
        timerServiceRef.current.pauseTimerHttp();
      }
    }
  };

  const handleSaveState = () => {
    const name = prompt("Nombre del estado:");
    if (!name?.trim()) {
      setError("El nombre del estado no puede estar vacío");
      return;
    }

    const descriptionValue: string | undefined = prompt(
      "Descripción (opcional):",
    )?.trim();

    if (timerServiceRef.current) {
      timerServiceRef.current
        .saveStateSocket(name.trim(), descriptionValue)
        .catch(() => {
          setError("Error al guardar el estado");
        });
    }
  };

  const handleAddTime = (type: DonationType) => {
    const minutes = prompt("Minutos a añadir:");
    if (minutes) {
      const username = prompt("Nombre de usuario:");
      if (username) {
        const metadata = {
          username,
          message: prompt("Mensaje (opcional):") || undefined,
          emotes:
            prompt("Emotes (opcional, separados por coma):")
              ?.split(",")
              .map((e) => e.trim()) || undefined,
          ...(type === "BITS" && { bits: Number(prompt("Cantidad de bits:")) }),
          ...(type === "RAID" && {
            viewers: Number(prompt("Cantidad de viewers:")),
          }),
        };

        if (timerServiceRef.current) {
          timerServiceRef.current.addTimeSocket(
            Number(minutes),
            type,
            metadata,
          );
        }
      }
    }
  };

  const getTimerStatus = () => {
    if (!isConnected) return "Desconectado";
    if (isStopped) return "Detenido";
    if (isPaused) return "Pausado";
    if (isActive) return "En ejecución";
    return "Desconocido";
  };

  const getTimerTooltip = () => {
    const status = getTimerStatus();
    const type =
      currentTimerType === "COUNTDOWN"
        ? "Cuenta Regresiva"
        : "Cuenta Ascendente";
    return `${currentTimerName}. Tipo: ${type}. Estado: ${status}.`;
  };

  const actionButtons: PanelButton[] = [
    {
      icon: Timer,
      tooltip: getTimerTooltip(),
      onClick: () => {},
      disabled: false,
    },
    {
      icon: ClockPlus,
      tooltip: "Crear",
      onClick: handleCreate,
      disabled: !isConnected,
    },
    {
      icon: Play,
      tooltip: isPaused ? "Reanudar" : "Iniciar",
      onClick: handleStart,
      disabled: !isConnected || (!isStopped && !isPaused),
    },
    {
      icon: TimerReset,
      tooltip: "Restablecer",
      onClick: handleReset,
      disabled: !isConnected,
    },
    {
      icon: Pause,
      tooltip: "Pausar",
      onClick: handlePause,
      disabled: !isConnected || !isActive || isPaused || isStopped,
    },
    {
      icon: Save,
      tooltip: "Guardar Estado",
      onClick: handleSaveState,
      disabled: !isConnected,
    },
    {
      icon: Shuffle,
      tooltip: useSocket ? "Usando Socket" : "Usando HTTP",
      onClick: () => setUseSocket(!useSocket),
      disabled: !isConnected,
    },
  ];

  const donationButtons: PanelButton[] = [
    {
      icon: Hash,
      tooltip: "Añadir Bits",
      onClick: () => handleAddTime("BITS"),
      disabled: !isConnected,
    },
    {
      icon: Server,
      tooltip: "Añadir Raid",
      onClick: () => handleAddTime("RAID"),
      disabled: !isConnected,
    },
    {
      icon: Gift,
      tooltip: "Añadir Sub",
      onClick: () => handleAddTime("SUBSCRIPTION"),
      disabled: !isConnected,
    },
  ];

  return (
    <div className="space-y-4 relative">
      {error && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full flex justify-center">
          <Alert variant={error ? "destructive" : "default"} className="w-1/2">
            <Trash2 onClick={handleCloseError} />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        </div>
      )}

      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4 z-50 relative">
        <div className="absolute right-0 top-0">
          <ThemeSelector />
        </div>

        {/* Panel de botones centrado */}
        <div className="flex flex-col items-center">
          <ButtonPanel
            topButtons={actionButtons}
            bottomButtons={donationButtons}
          />
        </div>
      </div>

      <FloatingTimer formattedTime={formattedTime || formatTime(timer)} />

      {showCreateModal && (
        <CreateTimerModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTimer}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
