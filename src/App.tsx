import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import "./App.css";
import { CreateTimerModal } from "./components/CreateTimerModal";
import { FloatingTimer } from "./components/FloatingTimer";
import TimerService from "./services/timerService";
import type {
  DonationType,
  SavedTimerState,
  TimerError,
  TimerState,
  TimerType,
} from "./types/timer.types";

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [timerType, setTimerType] = useState<TimerType>("COUNTDOWN");
  const [useSocket, setUseSocket] = useState<boolean>(true);
  const [savedStates, setSavedStates] = useState<SavedTimerState[]>([]);
  const [showSavedStates, setShowSavedStates] = useState<boolean>(false);
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
      setTimerType(data.type);
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
            setTimerType(defaultType);
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

  const formatTime = (seconds: number | string | undefined): string => {
    const parsedSeconds =
      typeof seconds === "string" ? Number.parseInt(seconds, 10) : seconds;

    if (
      parsedSeconds === undefined ||
      Number.isNaN(parsedSeconds) ||
      parsedSeconds < 0
    ) {
      return "0:00";
    }

    const minutes = Math.floor(parsedSeconds / 60);
    const remainingSeconds = Math.floor(parsedSeconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

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
    setTimerType(type);

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

    const description = prompt("Descripción (opcional):");
    if (timerServiceRef.current) {
      timerServiceRef.current
        .saveStateSocket(name.trim(), description?.trim() || undefined)
        .catch(() => {
          setError("Error al guardar el estado");
        });
    }
  };

  const handleLoadState = () => {
    if (timerServiceRef.current) {
      timerServiceRef.current.loadStateSocket().catch(() => {
        setError("Error al cargar el estado");
      });
    }
  };

  const handleGetSavedStates = () => {
    if (timerServiceRef.current) {
      timerServiceRef.current
        .getSavedStatesSocket()
        .then((states) => {
          setSavedStates(states);
        })
        .catch(() => {
          setError("Error al obtener estados guardados");
        });
      setShowSavedStates(true);
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

  return (
    <div className="overlay">
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleCloseError}
            className="close-error"
          >
            ×
          </button>
        </div>
      )}

      <div className="controls">
        <button type="button" onClick={handleCreate} disabled={!isConnected}>
          Crear
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={!isConnected || (!isStopped && !isPaused)}
          title={
            !isStopped && !isPaused
              ? "El timer debe estar detenido o pausado para iniciar o reanudar"
              : ""
          }
        >
          {isPaused ? "Reanudar" : "Iniciar"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!isConnected}
          title="Restablecer el timer a su estado inicial"
        >
          Restablecer
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={!isConnected || !isActive || isPaused || isStopped}
          title={!isActive ? "El timer debe estar activo para pausar" : ""}
        >
          Pausar
        </button>
        <button type="button" onClick={handleSaveState} disabled={!isConnected}>
          Guardar Estado
        </button>
        <button
          type="button"
          onClick={() => handleLoadState()}
          disabled={!isConnected}
        >
          Cargar Estado
        </button>
        <button
          type="button"
          onClick={handleGetSavedStates}
          disabled={!isConnected}
        >
          Estados Guardados
        </button>
        <button
          type="button"
          onClick={() => setUseSocket(!useSocket)}
          className={useSocket ? "socket-active" : "http-active"}
        >
          {useSocket ? "Usando Socket" : "Usando HTTP"}
        </button>
      </div>

      <div className="donation-controls">
        <button
          type="button"
          onClick={() => handleAddTime("BITS")}
          disabled={!isConnected}
        >
          Añadir Bits
        </button>
        <button
          type="button"
          onClick={() => handleAddTime("RAID")}
          disabled={!isConnected}
        >
          Añadir Raid
        </button>
        <button
          type="button"
          onClick={() => handleAddTime("SUBSCRIPTION")}
          disabled={!isConnected}
        >
          Añadir Sub
        </button>
      </div>

      <FloatingTimer
        timer={timer}
        timerName={currentTimerName}
        timerType={timerType}
        isActive={isActive}
        isPaused={isPaused}
        isStopped={isStopped}
        isConnected={isConnected}
        formatTime={formatTime}
      />

      {showSavedStates && (
        <>
          <div
            onKeyDown={() => {}}
            onKeyUp={() => {}}
            className="modal-overlay"
            onClick={() => setShowSavedStates(false)}
          />
          <div className="saved-states">
            <h3>Estados Guardados</h3>
            <button type="button" onClick={() => setShowSavedStates(false)}>
              Cerrar
            </button>
            {savedStates.length === 0 ? (
              <p
                style={{
                  color: "#00ff00",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No hay estados guardados
              </p>
            ) : (
              <ul>
                {savedStates.map((state) => (
                  <li
                    key={state.timerKey}
                    onClick={() => {
                      if (timerServiceRef.current) {
                        handleLoadState();
                        setShowSavedStates(false);
                      }
                    }}
                    onKeyDown={() => {}}
                    onKeyUp={() => {}}
                  >
                    <div className="state-info">
                      <span className="state-name">
                        {state.timerName || state.timerName}
                      </span>
                      <span className="state-type">{state.type}</span>
                      <span className="state-time">
                        {formatTime(state.currentTime)}
                      </span>
                      {state?.description && (
                        <span className="state-description">
                          {state.description}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

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

export default App;
