import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";

interface FloatingTimerProps {
  formattedTime?: string;
}

export function FloatingTimer({ formattedTime }: FloatingTimerProps) {
  const baseWidth = 300;
  const baseHeight = 150;

  const [size, setSize] = useState({ width: baseWidth, height: baseHeight });
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [loaded, setLoaded] = useState(false); // posición + tamaño

  useEffect(() => {
    const savedPosition = localStorage.getItem("timerPosition");
    const savedSize = localStorage.getItem("timerSize");

    let initialPosition = {
      x: (window.innerWidth - baseWidth) / 2,
      y: (window.innerHeight - baseHeight) / 2,
    };

    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          initialPosition = parsed;
        }
      } catch (e) {
        console.warn("Invalid position in localStorage", e);
      }
    }

    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize);
        if (
          typeof parsed.width === "number" &&
          typeof parsed.height === "number"
        ) {
          setSize(parsed);
        }
      } catch (e) {
        console.warn("Invalid size in localStorage", e);
      }
    }

    setPosition(initialPosition);
    setLoaded(true);

    // Responsivo: actualizar posición centrada si no había guardado antes
    const handleResize = () => {
      if (!savedPosition) {
        setPosition({
          x: (window.innerWidth - size.width) / 2,
          y: (window.innerHeight - size.height) / 2,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size.width, size.height]);

  if (!loaded) return null;

  return (
    <Rnd
      default={{
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      }}
      size={size}
      onDragStop={(_, d) => {
        const newPos = { x: d.x, y: d.y };
        setPosition(newPos);
        localStorage.setItem("timerPosition", JSON.stringify(newPos));
      }}
      onResizeStop={(e, direction, ref) => {
        const newSize = {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        };
        setSize(newSize);
        localStorage.setItem("timerSize", JSON.stringify(newSize));
      }}
      style={{
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
        {formattedTime}
      </div>
    </Rnd>
  );
}
