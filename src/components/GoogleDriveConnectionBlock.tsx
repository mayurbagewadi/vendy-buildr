import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoogleDriveConnectionBlockProps {
  variant?: "default" | "compact";
  showDescription?: boolean;
}

export const GoogleDriveConnectionBlock = ({
  variant = "default",
  showDescription = true
}: GoogleDriveConnectionBlockProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    verifyConnection();
  }, []);

  const verifyConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase.functions.invoke('verify-drive-connection', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setIsConnected(data?.connected || false);
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.file',
          redirectTo: window.location.href,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <HardDrive className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-sm">Google Drive</p>
            <p className="text-xs text-muted-foreground">
              {isConnected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={isConnected ? "outline" : "default"}
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : isConnected ? (
            <>
              <HardDrive className="w-4 h-4 mr-2" />
              Reconnect
            </>
          ) : (
            <>
              <HardDrive className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={`admin-card ${!isConnected ? 'border-red-500 border-2' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <HardDrive className="w-5 h-5 text-primary" />
          </div>
          Connect Your Google Drive
        </CardTitle>
        {showDescription && (
          <CardDescription>
            Store and manage product images securely in your Google Drive
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {isConnected ? "✓ Connected" : "Not Connected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? "Your Google Drive is ready for image uploads"
                : "Connect to enable direct uploads"}
            </p>
          </div>
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            variant={isConnected ? "outline" : "default"}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <HardDrive className="w-4 h-4 mr-2" />
                Reconnect
              </>
            ) : (
              <>
                <HardDrive className="w-4 h-4 mr-2" />
                Connect Google Drive
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleDriveConnectionBlock;
