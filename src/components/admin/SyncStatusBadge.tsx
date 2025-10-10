import { CheckCircle2, XCircle, Clock, Cloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SyncStatusBadgeProps {
  isEnabled: boolean;
  lastSync?: string | null;
}

export const SyncStatusBadge = ({ isEnabled, lastSync }: SyncStatusBadgeProps) => {
  if (!isEnabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1.5">
              <XCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Not Syncing</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Google Sheets sync is not configured</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="gap-1.5 border-success/50 bg-success/10">
            <Cloud className="h-3 w-3 text-success" />
            <span className="text-success">Syncing</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {lastSync 
              ? `Last synced ${formatTimeAgo(lastSync)}`
              : "Google Sheets sync is active"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
