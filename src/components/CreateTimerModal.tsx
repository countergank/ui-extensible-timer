import { useState } from 'react';
import type { TimerType } from '../types/timer.types';

interface CreateTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (timerKey: string, timerName: string, type: TimerType, initialTime?: number) => void;
}

export function CreateTimerModal({ isOpen, onClose, onCreate }: CreateTimerModalProps) {
  const [timerKey, setTimerKey] = useState('');
  const [timerName, setTimerName] = useState('');
  const [timerType, setTimerType] = useState<TimerType>('COUNTDOWN');
  const [initialMinutes, setInitialMinutes] = useState<number>(0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert minutes to seconds before passing to parent
    const initialTimeInSeconds = initialMinutes * 60;
    onCreate(timerKey, timerName, timerType, initialTimeInSeconds);
    setTimerKey('');
    setTimerName('');
    setTimerType('COUNTDOWN');
    setInitialMinutes(0);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Crear Nuevo Temporizador</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="timerKey">Identificador:</label>
            <input
              type="text"
              id="timerKey"
              value={timerKey}
              onChange={(e) => setTimerKey(e.target.value)}
              required
              placeholder="Ingrese el identificador"
            />
          </div>
          <div className="form-group">
            <label htmlFor="timerName">Nombre:</label>
            <input
              type="text"
              id="timerName"
              value={timerName}
              onChange={(e) => setTimerName(e.target.value)}
              placeholder="Ingrese el nombre (opcional)"
            />
          </div>
          <div className="form-group">
            <label htmlFor="timerType">Tipo:</label>
            <select
              id="timerType"
              value={timerType}
              onChange={(e) => setTimerType(e.target.value as TimerType)}
            >
              <option value="COUNTDOWN">Cuenta Regresiva</option>
              <option value="COUNTUP">Cuenta Ascendente</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="initialTime">Tiempo Inicial (minutos):</label>
            <input
              type="number"
              id="initialTime"
              value={initialMinutes}
              onChange={(e) => setInitialMinutes(Number(e.target.value))}
              min="0"
              placeholder="Ingrese el tiempo inicial en minutos (opcional)"
            />
          </div>
          <div className="modal-buttons">
            <button type="submit">Crear</button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
