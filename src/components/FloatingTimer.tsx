import { useState } from "react";
import { Rnd } from "react-rnd";

interface FloatingTimerProps {
  timer: number;
  formatTime: (seconds: number) => string;
}

export function FloatingTimer({ timer, formatTime }: FloatingTimerProps) {
  const baseWidth = 300;
  const baseHeight = 150;

  const [size, setSize] = useState({ width: baseWidth, height: baseHeight });
  const [position] = useState({ x: 20, y: 20 });

  return (
    <Rnd
      default={{
        x: position.x,
        y: position.y,
        width: baseWidth,
        height: baseHeight,
      }}
      size={{ width: size.width, height: size.height }}
      onResizeStop={(e, direction, ref) => {
        setSize({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        });
      }}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        margin: 0,
        border: "1px solid #ccc",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: `calc(min(${size.width}px, ${size.height}px) * 0.4)`,
          lineHeight: 1,
        }}
      >
        {formatTime(timer)}
      </div>
    </Rnd>
  );
}
