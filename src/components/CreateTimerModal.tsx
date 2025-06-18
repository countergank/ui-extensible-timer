import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import type { TimerType } from "../types/timer.types";

interface CreateTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    timerKey: string,
    timerName: string,
    type: TimerType,
    initialTime?: number,
  ) => void;
}

export function CreateTimerModal({
  isOpen,
  onClose,
  onCreate,
}: CreateTimerModalProps) {
  const [timerKey, setTimerKey] = useState("");
  const [timerName, setTimerName] = useState("");
  const [timerType, setTimerType] = useState<TimerType>("COUNTDOWN");
  const [initialMinutes, setInitialMinutes] = useState<number>(0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert minutes to seconds before passing to parent
    const initialTimeInSeconds = initialMinutes * 60;
    onCreate(timerKey, timerName, timerType, initialTimeInSeconds);
    setTimerKey("");
    setTimerName("");
    setTimerType("COUNTDOWN");
    setInitialMinutes(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Temporizador</DialogTitle>
          <DialogDescription>
            Crea un nuevo temporizador con las siguientes opciones.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="timerKey" className="text-right">
              Identificador:
            </Label>
            <Input
              type="text"
              id="timerKey"
              value={timerKey}
              onChange={(e) => setTimerKey(e.target.value)}
              required
              placeholder="Ingrese el identificador"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timerName" className="text-right">
              Nombre:
            </Label>
            <Input
              type="text"
              id="timerName"
              value={timerName}
              onChange={(e) => setTimerName(e.target.value)}
              placeholder="Ingrese el nombre (opcional)"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="timerType" className="text-right">
              Tipo:
            </Label>
            <Select onValueChange={(value) => setTimerType(value as TimerType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COUNTDOWN">Cuenta Regresiva</SelectItem>
                <SelectItem value="COUNTUP">Cuenta Ascendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="initialTime" className="text-right">
              Tiempo Inicial (minutos):
            </Label>
            <Input
              type="number"
              id="initialTime"
              value={initialMinutes}
              onChange={(e) => setInitialMinutes(Number(e.target.value))}
              min="0"
              placeholder="Ingrese el tiempo inicial en minutos (opcional)"
            />
          </div>
          <DialogFooter>
            <Button type="submit">Crear</Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
