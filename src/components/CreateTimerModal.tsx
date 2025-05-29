import { useState } from 'react';

interface CreateTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (timerKey: string, timerName: string, type: 'COUNTDOWN' | 'COUNTUP') => void;
}

export function CreateTimerModal({ isOpen, onClose, onCreate }: CreateTimerModalProps) {
  const [timerKey, setTimerKey] = useState('');
  const [timerName, setTimerName] = useState('');
  const [timerType, setTimerType] = useState<'COUNTDOWN' | 'COUNTUP'>('COUNTDOWN');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(timerKey, timerName, timerType);
    setTimerKey('');
    setTimerName('');
    setTimerType('COUNTDOWN');
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
              required
              placeholder="Ingrese el nombre"
            />
          </div>
          <div className="form-group">
            <label htmlFor="timerType">Tipo:</label>
            <select
              id="timerType"
              value={timerType}
              onChange={(e) => setTimerType(e.target.value as 'COUNTDOWN' | 'COUNTUP')}
            >
              <option value="COUNTDOWN">Cuenta Regresiva</option>
              <option value="COUNTUP">Cuenta Ascendente</option>
            </select>
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