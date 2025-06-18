import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTime } from "@/lib/formatTime";
import {
  Gift,
  Hash,
  Pause,
  Play,
  Plus,
  Redo,
  Save,
  Server,
  Shuffle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import type { Socket } from "socket.io-client";
import "./App.css";
import { CreateTimerModal } from "./components/CreateTimerModal";
import { FloatingTimer } from "./components/FloatingTimer";
import ThemeSelector from "./components/ThemeSelector";
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

  interface ButtonDefinition {
    icon: IconType;
    tooltip: string;
    onClick: (type?: DonationType) => void;
    disabled: (
      isConnected: boolean,
      isActive: boolean,
      isPaused: boolean,
      isStopped: boolean,
    ) => boolean;
  }

  const buttonDefinitions: ButtonDefinition[] = [
    {
      icon: Plus,
      tooltip: "Crear",
      onClick: handleCreate,
      disabled: (isConnected) => !isConnected,
    },
    {
      icon: Play,
      tooltip: isPaused ? "Reanudar" : "Iniciar",
      onClick: handleStart,
      disabled: (isConnected, isActive, isPaused, isStopped) =>
        !isConnected || (!isStopped && !isPaused),
    },
    {
      icon: Redo,
      tooltip: "Restablecer",
      onClick: handleReset,
      disabled: (isConnected) => !isConnected,
    },
    {
      icon: Pause,
      tooltip: "Pausar",
      onClick: handlePause,
      disabled: (isConnected, isActive, isPaused, isStopped) =>
        !isConnected || !isActive || isPaused || isStopped,
    },
    {
      icon: Save,
      tooltip: "Guardar Estado",
      onClick: handleSaveState,
      disabled: (isConnected) => !isConnected,
    },
    {
      icon: Shuffle,
      tooltip: useSocket ? "Usando Socket" : "Usando HTTP",
      onClick: () => setUseSocket(!useSocket),
      disabled: (isConnected) => !isConnected,
    },
  ];

  const donationButtons = [
    {
      icon: Hash,
      tooltip: "Añadir Bits",
      onClick: () => handleAddTime("BITS"),
      disabled: (isConnected) => !isConnected,
    },
    {
      icon: Server,
      tooltip: "Añadir Raid",
      onClick: () => handleAddTime("RAID"),
      disabled: (isConnected) => !isConnected,
    },
    {
      icon: Gift,
      tooltip: "Añadir Sub",
      onClick: () => handleAddTime("SUBSCRIPTION"),
      disabled: (isConnected) => !isConnected,
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive bg-destructive/15 p-3 text-sm text-destructive">
          <span className="font-medium">{error}</span>
          <Button variant="ghost" onClick={handleCloseError}>
            ×
          </Button>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <ThemeSelector />
        {buttonDefinitions.map((button) => (
          <TooltipProvider key={button.tooltip}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => button.onClick()}
                  disabled={button.disabled(
                    isConnected,
                    isActive,
                    isPaused,
                    isStopped,
                  )}
                >
                  <button.icon />
                  <span className="sr-only">{button.tooltip}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{button.tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        {donationButtons.map((button) => (
          <TooltipProvider key={button.tooltip}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={button.onClick}
                  disabled={button.disabled(isConnected)}
                >
                  <button.icon />
                  <span className="sr-only">{button.tooltip}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{button.tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      <FloatingTimer timer={timer} formatTime={formatTime} />

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
