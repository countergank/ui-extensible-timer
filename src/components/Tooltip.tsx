import type React from "react";
import { useState } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      {children}
      {isTooltipVisible && <div>{text}</div>}
    </div>
  );
};

export default Tooltip;
