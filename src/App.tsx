import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import './App.css';
import { CreateTimerModal } from './components/CreateTimerModal';
import { FloatingTimer } from './components/FloatingTimer';
import TimerService from './services/timerService';
import type { DonationType, SavedTimerState, TimerError, TimerState, TimerType } from './types/timer.types';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [timerType, setTimerType] = useState<TimerType>('COUNTDOWN');
  const [useSocket, setUseSocket] = useState<boolean>(true);
  const [savedStates, setSavedStates] = useState<SavedTimerState[]>([]);
  const [showSavedStates, setShowSavedStates] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [currentTimerKey, setCurrentTimerKey] = useState<string>('twitch');
  const [currentTimerName, setCurrentTimerName] = useState<string>('main-timer');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStateName, setSaveStateName] = useState('');
  const [saveStateDescription, setSaveStateDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorTimeout, setErrorTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Crear una referencia al timerService para evitar recrearlo en cada render
  const timerServiceRef = useRef<TimerService | null>(null);

  const handleTimerUpdate = useCallback((data: TimerState) => {
    console.log('[TIMER EVENT] Recibido:', data);
    try {
      // Validar que data sea un objeto válido
      if (!data || typeof data !== 'object') {
        throw new Error('Datos del temporizador inválidos: objeto nulo o inválido');
      }

      // Validar que currentTime sea un número válido
      if (typeof data.currentTime !== 'number' || isNaN(data.currentTime)) {
        throw new Error('Datos del temporizador inválidos: tiempo actual no es un número válido');
      }

      // Validar que el tipo de timer sea válido
      if (!['COUNTDOWN', 'COUNTUP'].includes(data.type)) {
        throw new Error('Datos del temporizador inválidos: tipo de timer no válido');
      }

      // Validar que el estado sea válido
      if (!['RUNNING', 'PAUSED', 'STOPPED'].includes(data.status)) {
        throw new Error('Datos del temporizador inválidos: estado no válido');
      }

      // Determinar el estado del timer basado en el status del servidor
      const status = data.status.toUpperCase();
      const isActive = status === 'RUNNING';
      const isPaused = status === 'PAUSED';
      const isStopped = status === 'STOPPED';

      // Mantener el tiempo actual cuando se pausa
      const shouldKeepCurrentTime = data.status === 'PAUSED' && isActive;
      const currentTime = shouldKeepCurrentTime
        ? timer // Mantener el tiempo actual
        : data.type === 'COUNTDOWN'
          ? Math.max(0, data.currentTime) // Para countdown, no permitir valores negativos
          : data.currentTime; // Para countup, permitir cualquier valor

      // Actualizar el estado del timer
      setTimer(currentTime);
      setIsActive(isActive);
      setIsPaused(isPaused);
      setIsStopped(isStopped);
      setTimerType(data.type);
      setIsLoading(false);
      setError(null); // Limpiar cualquier error previo

      console.log('[TIMER STATE] Actualizado:', {
        timer: currentTime,
        isActive,
        isPaused,
        isStopped,
        timerType: data.type,
        status,
        lastUpdated: data.lastUpdated
      });

      // Si es countdown y llegó a 0, detener el timer
      if (data.type === 'COUNTDOWN' && currentTime === 0 && isActive) {
        if (timerServiceRef.current) {
          timerServiceRef.current.stopTimerSocket();
        }
      }
    } catch (error) {
      console.error('[TIMER ERROR]', error);
      setError(error instanceof Error ? error.message : 'Error al actualizar el temporizador');
      setIsLoading(false);
    }
  }, []);

  // Efecto para monitorear cambios en el timer
  useEffect(() => {
  }, [timer, timerType, isActive, isPaused, isStopped, isConnected]);

  // Función para manejar errores con timeout
  const handleError = (message: string) => {
    setError(message);
    // Limpiar timeout anterior si existe
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    // Establecer nuevo timeout
    const timeout = setTimeout(() => {
      setError(null);
    }, 5000); // 5 segundos
    setErrorTimeout(timeout);
  };

  // Función para cerrar el error manualmente
  const handleCloseError = () => {
    setError(null);
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }
  };

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    if (!connected) {
      handleError('Conexión perdida. Intentando reconectar...');
    } else {
      setError(null);
    }

    if (timerServiceRef.current) {
      // Verificar si el timer existe
      timerServiceRef.current.checkTimerExists()
        .then(exists => {
          if (!exists) {
            // Usar variables de entorno con valores por defecto
            const defaultType = (import.meta.env.VITE_DEFAULT_TIMER_TYPE || 'COUNTDOWN') as TimerType;
            const defaultTime = Number(import.meta.env.VITE_DEFAULT_INITIAL_TIME) || 60 * 60;
            const defaultKey = import.meta.env.VITE_DEFAULT_TIMER_KEY || 'main-timer';

            setCurrentTimerKey(defaultKey);
            setCurrentTimerName(timerServiceRef.current?.generateFriendlyName(defaultKey, defaultType) || '');
            setTimerType(defaultType);
            setTimer(defaultTime);

            return timerServiceRef.current?.createTimerSocket(defaultType, defaultTime);
          } else {
            return timerServiceRef.current?.getTimerStateHttp();
          }
        })
        .then((state: TimerState | undefined) => {
          if (state) {
            handleTimerUpdate(state);
          }
        })
        .catch(error => {
          setError('Error al obtener el estado del timer');
          setTimer(0);
          setIsActive(false);
        });
    }
  }, [handleTimerUpdate]);

  // Efecto para inicializar el timerService
  useEffect(() => {
    timerServiceRef.current = new TimerService(currentTimerKey, currentTimerName);

    // Obtener el estado inicial del timer
    const initializeTimer = async () => {
      try {
        const state = await timerServiceRef.current?.getTimerStateHttp();
        if (state) {
          handleTimerUpdate(state);
        }
      } catch (error) {
        setError('Error al obtener el estado inicial del timer');
      } finally {
        setIsLoading(false);
      }
    };

    initializeTimer();

    return () => {
      timerServiceRef.current?.disconnect();
      timerServiceRef.current = null;
    };
  }, [currentTimerKey, currentTimerName, handleTimerUpdate]);

  // Efecto para manejar la conexión y suscripciones
  useEffect(() => {
    if (!timerServiceRef.current) return;

    const service = timerServiceRef.current;
    const newSocket = service.connect();
    setSocket(newSocket);

    // Suscribirse a eventos
    service.subscribeToTimer(handleTimerUpdate);
    service.subscribeToConnection(handleConnectionChange);
    service.subscribeToError((error: TimerError) => {
      handleError(error.message);
    });
    service.subscribeToSavedStates((states) => {
      setSavedStates(states);
    });

    // Intentar reconexión si es necesario
    const attemptReconnect = async () => {
      if (!service.isConnected()) {
        console.log('🔄 Intentando reconexión...');
        await service.ensureConnection();
      }
    };

    // Intentar reconexión cada 5 segundos si no está conectado
    const reconnectInterval = setInterval(attemptReconnect, 5000);

    return () => {
      clearInterval(reconnectInterval);
      service.unsubscribeFromTimer(handleTimerUpdate);
      service.unsubscribeFromConnection(handleConnectionChange);
      service.unsubscribeFromError((error: TimerError) => {
        handleError(error.message);
      });
      service.disconnect();
    };
  }, [handleTimerUpdate, handleConnectionChange]);

  // Efecto para manejar la reconexión cuando el socket se pierde
  useEffect(() => {
    if (!socket) return;

    const handleDisconnect = () => {
      console.log('❌ Socket desconectado, intentando reconectar...');
      if (timerServiceRef.current) {
        timerServiceRef.current.ensureConnection();
      }
    };

    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  const formatTime = (seconds: number | undefined) => {
    if (typeof seconds === 'string') seconds = parseInt(seconds, 10);
    if (seconds === undefined || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimerStatus = () => {
    if (!isConnected) return 'Desconectado';
    if (isStopped) return 'Detenido';
    if (isPaused) return 'Pausado';
    if (isActive) return 'En ejecución';
    return 'Desconocido';
  };

  const getTimerTooltip = () => {
    const status = getTimerStatus();
    const type = timerType === 'COUNTDOWN' ? 'Cuenta Regresiva' : 'Cuenta Ascendente';
    return `${currentTimerName}\nTipo: ${type}\nEstado: ${status}\nTiempo: ${formatTime(timer)}`;
  };

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleCreateTimer = (timerKey: string, timerName: string, type: TimerType, initialTime?: number) => {
    setCurrentTimerKey(timerKey);
    setCurrentTimerName(timerName);
    setTimerType(type);

    if (timerServiceRef.current) {
      timerServiceRef.current.setTimerInfo(timerKey, timerName);
      if (useSocket) {
        timerServiceRef.current.createTimerSocket(type, initialTime);
      } else {
        timerServiceRef.current.createTimer(type, initialTime);
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
      setError('No hay conexión con el servidor');
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
    const name = prompt('Nombre del estado:');
    if (!name?.trim()) {
      setError('El nombre del estado no puede estar vacío');
      return;
    }

    const description = prompt('Descripción (opcional):');
    if (timerServiceRef.current) {
      timerServiceRef.current.saveStateSocket(name.trim(), description?.trim() || undefined)
        .catch(error => {
          setError('Error al guardar el estado');
        });
    }
  };

  const handleLoadState = (stateId?: string) => {
    if (timerServiceRef.current) {
      timerServiceRef.current.loadStateSocket(stateId)
        .catch(error => {
          setError('Error al cargar el estado');
        });
    }
  };

  const handleGetSavedStates = () => {
    if (timerServiceRef.current) {
      timerServiceRef.current.getSavedStatesSocket()
        .catch(error => {
          setError('Error al obtener estados guardados');
        });
      setShowSavedStates(true);
    }
  };

  const handleAddTime = (type: DonationType) => {
    const minutes = prompt('Minutos a añadir:');
    if (minutes) {
      const username = prompt('Nombre de usuario:');
      if (username) {
        const metadata = {
          username,
          message: prompt('Mensaje (opcional):') || undefined,
          emotes: prompt('Emotes (opcional, separados por coma):')?.split(',').map(e => e.trim()) || undefined,
          ...(type === 'BITS' && { bits: Number(prompt('Cantidad de bits:')) }),
          ...(type === 'RAID' && { viewers: Number(prompt('Cantidad de viewers:')) })
        };

        if (timerServiceRef.current) {
          timerServiceRef.current.addTimeSocket(Number(minutes), type, metadata);
        }
      }
    }
  };

  return (
    <div className="overlay">
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={handleCloseError} className="close-error">×</button>
        </div>
      )}

      <div className="controls">
        <button onClick={handleCreate} disabled={!isConnected}>Crear</button>
        <button
          onClick={handleStart}
          disabled={!isConnected || (!isStopped && !isPaused)}
          title={(!isStopped && !isPaused) ? "El timer debe estar detenido o pausado para iniciar o reanudar" : ""}
        >
          {isPaused ? "Reanudar" : "Iniciar"}
        </button>
        <button
          onClick={handleReset}
          disabled={!isConnected}
          title="Restablecer el timer a su estado inicial"
        >
          Restablecer
        </button>
        <button
          onClick={handlePause}
          disabled={!isConnected || !isActive || isPaused || isStopped}
          title={!isActive ? "El timer debe estar activo para pausar" : ""}
        >
          Pausar
        </button>
        <button onClick={handleSaveState} disabled={!isConnected}>Guardar Estado</button>
        <button onClick={() => handleLoadState()} disabled={!isConnected}>Cargar Estado</button>
        <button onClick={handleGetSavedStates} disabled={!isConnected}>Estados Guardados</button>
        <button
          onClick={() => setUseSocket(!useSocket)}
          className={useSocket ? 'socket-active' : 'http-active'}
        >
          {useSocket ? 'Usando Socket' : 'Usando HTTP'}
        </button>
      </div>

      <div className="donation-controls">
        <button onClick={() => handleAddTime('BITS')} disabled={!isConnected}>Añadir Bits</button>
        <button onClick={() => handleAddTime('RAID')} disabled={!isConnected}>Añadir Raid</button>
        <button onClick={() => handleAddTime('SUBSCRIPTION')} disabled={!isConnected}>Añadir Sub</button>
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
          <div className="modal-overlay" onClick={() => setShowSavedStates(false)} />
          <div className="saved-states">
            <h3>Estados Guardados</h3>
            <button onClick={() => setShowSavedStates(false)}>Cerrar</button>
            {savedStates.length === 0 ? (
              <p style={{ color: '#00ff00', textAlign: 'center', padding: '20px' }}>
                No hay estados guardados
              </p>
            ) : (
              <ul>
                {savedStates.map((state) => (
                  <li key={state.stateId} onClick={() => {
                    if (timerServiceRef.current) {
                      handleLoadState(state.stateId);
                      setShowSavedStates(false);
                    }
                  }}>
                    <div className="state-info">
                      <span className="state-name">{state.name || state.timerName}</span>
                      <span className="state-type">{state.type}</span>
                      <span className="state-time">{formatTime(state.currentTime)}</span>
                      {state.description && (
                        <span className="state-description">{state.description}</span>
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
