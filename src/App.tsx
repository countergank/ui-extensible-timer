import { useCallback, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import './App.css';
import { CreateTimerModal } from './components/CreateTimerModal';
import { timerService } from './services/timerService';
import type { SavedTimerState, TimerState } from './types/timer.types';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [timerType, setTimerType] = useState<'COUNTDOWN' | 'COUNTUP'>('COUNTDOWN');
  const [useSocket, setUseSocket] = useState<boolean>(true);
  const [savedStates, setSavedStates] = useState<SavedTimerState[]>([]);
  const [showSavedStates, setShowSavedStates] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [currentTimerKey, setCurrentTimerKey] = useState<string>('test-key');
  const [currentTimerName, setCurrentTimerName] = useState<string>('main-timer');

  const handleTimerUpdate = useCallback((data: TimerState) => {
    console.log('Datos recibidos del temporizador:', data);
    if (data && typeof data.currentTime === 'number') {
      setTimer(data.currentTime);
      setIsActive(data.status === 'RUNNING');
      setIsPaused(data.status === 'PAUSED');
      setIsStopped(data.status === 'STOPPED');
      setTimerType(data.type);
    } else {
      console.warn('Datos del temporizador inválidos:', data);
    }
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log('Estado de conexión:', connected);
    setIsConnected(connected);
    if (connected) {
      // Obtener el estado actual del temporizador
      timerService.getTimerStateHttp()
        .then(response => response.json())
        .then((state: TimerState) => {
          console.log('Estado inicial recibido:', state);
          handleTimerUpdate(state);
        })
        .catch(error => {
          console.error('Error al obtener el estado:', error);
          // Inicializar con valores por defecto en caso de error
          setTimer(0);
          setIsActive(false);
        });
    }
  }, [handleTimerUpdate]);

  useEffect(() => {
    // Conectar al servidor socket.io
    const newSocket = timerService.connect();
    setSocket(newSocket);

    // Suscribirse a eventos
    timerService.subscribeToTimer(handleTimerUpdate);
    timerService.subscribeToConnection(handleConnectionChange);

    // Limpiar suscripciones al desmontar
    return () => {
      timerService.unsubscribeFromTimer(handleTimerUpdate);
      timerService.unsubscribeFromConnection(handleConnectionChange);
      timerService.disconnect();
    };
  }, [handleTimerUpdate, handleConnectionChange]);

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined || isNaN(seconds) || seconds < 0) {
      console.warn('Valor de tiempo inválido:', seconds);
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleCreateTimer = (timerKey: string, timerName: string, type: 'COUNTDOWN' | 'COUNTUP') => {
    setCurrentTimerKey(timerKey);
    setCurrentTimerName(timerName);
    setTimerType(type);

    timerService.setTimerInfo(timerKey, timerName);

    if (useSocket) {
      timerService.createTimerSocket(type, 300);
    } else {
      timerService.createTimer(type, 300);
    }
  };

  const handleStart = () => {
    if (isStopped) {
      if (useSocket) {
        timerService.startTimerSocket();
      } else {
        timerService.startTimerHttp();
      }
    } else {
      console.warn('No se puede iniciar un timer que no está detenido');
    }
  };

  const handleStop = () => {
    if (!isStopped) {
      if (useSocket) {
        timerService.stopTimerSocket();
      } else {
        timerService.stopTimerHttp();
      }
    } else {
      console.warn('El timer ya está detenido');
    }
  };

  const handlePause = () => {
    if (isActive && !isPaused && !isStopped) {
      if (useSocket) {
        timerService.pauseTimerSocket();
      } else {
        timerService.pauseTimerHttp();
      }
    } else {
      console.warn('No se puede pausar el timer en su estado actual');
    }
  };

  const handleResume = () => {
    if (isPaused && !isActive && !isStopped) {
      if (useSocket) {
        timerService.resumeTimerSocket();
      } else {
        timerService.resumeTimerHttp();
      }
    } else {
      console.warn('No se puede reanudar el timer en su estado actual');
    }
  };

  const handleSaveState = () => {
    const name = prompt('Nombre del estado:');
    if (name) {
      const description = prompt('Descripción (opcional):');
      timerService.saveStateSocket(name, description || undefined);
    }
  };

  const handleLoadState = () => {
    timerService.loadStateSocket();
  };

  const handleGetSavedStates = () => {
    timerService.getSavedStatesSocket();
    setShowSavedStates(true);
  };

  const handleAddTime = (type: 'BITS' | 'RAID' | 'SUBSCRIPTION') => {
    const minutes = prompt('Minutos a añadir:');
    if (minutes) {
      const username = prompt('Nombre de usuario:');
      if (username) {
        const metadata = {
          username,
          message: prompt('Mensaje (opcional):') || undefined,
          ...(type === 'BITS' && { bits: Number(prompt('Cantidad de bits:')) }),
          ...(type === 'RAID' && { viewers: Number(prompt('Cantidad de viewers:')) })
        };

        if (useSocket) {
          timerService.addTimeSocket(Number(minutes), type, metadata);
        } else {
          timerService.addTimeHttp(Number(minutes), type, metadata);
        }
      }
    }
  };

  return (
    <div className="overlay">
      <div className="controls">
        <button onClick={handleCreate} disabled={!isConnected}>Crear</button>
        <button
          onClick={handleStart}
          disabled={!isConnected || !isStopped}
          title={!isStopped ? "El timer debe estar detenido para iniciar" : ""}
        >
          Iniciar
        </button>
        <button
          onClick={handleStop}
          disabled={!isConnected || isStopped}
          title={isStopped ? "El timer ya está detenido" : ""}
        >
          Detener
        </button>
        <button
          onClick={handlePause}
          disabled={!isConnected || !isActive || isPaused || isStopped}
          title={!isActive ? "El timer debe estar activo para pausar" : ""}
        >
          Pausar
        </button>
        <button
          onClick={handleResume}
          disabled={!isConnected || !isPaused || isActive || isStopped}
          title={!isPaused ? "El timer debe estar pausado para reanudar" : ""}
        >
          Reanudar
        </button>
        <button onClick={handleSaveState} disabled={!isConnected}>Guardar Estado</button>
        <button onClick={handleLoadState} disabled={!isConnected}>Cargar Estado</button>
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

      <div className={`timer ${isActive ? 'active' : 'inactive'} ${!isConnected ? 'disconnected' : ''}`}>
        {formatTime(timer)}
      </div>

      {showSavedStates && (
        <div className="saved-states">
          <h3>Estados Guardados</h3>
          <button onClick={() => setShowSavedStates(false)}>Cerrar</button>
          <ul>
            {savedStates.map((state) => (
              <li key={state.stateId}>
                {state.timerName} - {state.type} - {formatTime(state.currentTime)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateTimerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateTimer}
      />
    </div>
  );
}

export default App;
