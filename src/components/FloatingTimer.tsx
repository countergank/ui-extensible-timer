import { useEffect, useRef, useState } from 'react';
import type { TimerType } from '../types/timer.types';

interface FloatingTimerProps {
  timer: number;
  timerName: string;
  timerType: TimerType;
  isActive: boolean;
  isPaused: boolean;
  isStopped: boolean;
  isConnected: boolean;
  formatTime: (seconds: number) => string;
}

export function FloatingTimer({
  timer,
  timerName,
  timerType,
  isActive,
  isPaused,
  isStopped,
  isConnected,
  formatTime
}: FloatingTimerProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const timerRef = useRef<HTMLDivElement>(null);

  // Cargar posición guardada al iniciar
  useEffect(() => {
    const savedPosition = localStorage.getItem('timerPosition');
    if (savedPosition) {
      setPosition(JSON.parse(savedPosition));
    }
  }, []);

  // Guardar posición cuando cambia
  useEffect(() => {
    localStorage.setItem('timerPosition', JSON.stringify(position));
  }, [position]);

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
    return `${timerName}\nTipo: ${type}\nEstado: ${status}\nTiempo: ${formatTime(timer)}`;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (timerRef.current) {
      const rect = timerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={timerRef}
      className={`floating-timer ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
      title={getTimerTooltip()}
    >
      <div className="timer-labels">
        <span className="timer-name">{timerName}</span>
        <span className="timer-status">{getTimerStatus()}</span>
      </div>
      <div
        className={`timer ${isActive ? 'active' : 'inactive'} ${!isConnected ? 'disconnected' : ''}`}
      >
        {formatTime(timer)}
      </div>
    </div>
  );
}
