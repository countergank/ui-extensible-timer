import type React from "react";
import "./IconButton.css";

interface IconButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  tooltip,
  onClick,
  disabled,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="icon-button"
      title={tooltip}
      disabled={disabled}
    >
      {icon}
    </button>
  );
};

export default IconButton;
