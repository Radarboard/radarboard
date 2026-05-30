import { Button, type ButtonProps } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";

interface ChatTooltipButtonProps extends ButtonProps {
  tooltip: string;
}

export function ChatTooltipButton({
  tooltip,
  className,
  variant = "ghost",
  size = "icon",
  uppercase = false,
  ...props
}: ChatTooltipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          uppercase={uppercase}
          className={cn("hover:bg-transparent", className)}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
