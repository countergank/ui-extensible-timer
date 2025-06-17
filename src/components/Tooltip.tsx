import type React from "react";
import { useState } from "react";
import "./Tooltip.css";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  return (
    <div
      className="tooltip-container"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      {children}
      {isTooltipVisible && <div className="tooltip">{text}</div>}
    </div>
  );
};

export default Tooltip;
