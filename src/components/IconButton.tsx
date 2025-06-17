import type React from "react";
import "./IconButton.css";
import Tooltip from "./Tooltip";

interface IconButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  disabled,
  tooltip,
}) => {
  return (
    <Tooltip text={tooltip}>
      <button
        type="button"
        onClick={onClick}
        className="icon-button"
        disabled={disabled}
      >
        {icon}
      </button>
    </Tooltip>
  );
};

export default IconButton;
