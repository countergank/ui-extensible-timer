import { Button } from "@/components/ui/button";
import type React from "react";
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
      <Button type="button" onClick={onClick} disabled={disabled}>
        {icon}
      </Button>
    </Tooltip>
  );
};

export default IconButton;
