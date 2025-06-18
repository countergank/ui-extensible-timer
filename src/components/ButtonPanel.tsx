import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { IconType } from "react-icons";

export interface PanelButton {
  tooltip?: string;
  icon?: IconType;
  onClick?: () => void;
  disabled?: boolean;
}

export function ButtonPanel({
  topButtons,
  bottomButtons,
}: {
  topButtons: PanelButton[];
  bottomButtons: PanelButton[];
}) {
  return (
    <Card className="shadow-md">
      <CardContent className="flex flex-col items-center gap-4 p-4">
        <div className="flex flex-wrap justify-center gap-2">
          {topButtons.map((button) => (
            <TooltipProvider key={button.tooltip}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => button.onClick()}
                    disabled={button.disabled}
                  >
                    <button.icon />
                    <span className="sr-only">{button.tooltip}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{button.tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {bottomButtons.map((button) => (
            <TooltipProvider key={button.tooltip}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={button.onClick}
                    disabled={button.disabled}
                  >
                    <button.icon />
                    <span className="sr-only">{button.tooltip}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{button.tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
