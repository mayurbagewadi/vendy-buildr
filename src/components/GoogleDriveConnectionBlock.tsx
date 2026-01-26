import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoogleDriveConnectionBlockProps {
  variant?: "default" | "compact";
  showDescription?: boolean;
  formData?: any;
}

export const GoogleDriveConnectionBlock = ({
  variant = "default",
  showDescription = true,
  formData
}: GoogleDriveConnectionBlockProps) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    verifyConnection();

    // Listen for auth state changes (e.g., after OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Re-verify connection after auth state changes
        setTimeout(() => verifyConnection(), 1000);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const verifyConnection = async () => {
    setIsVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsConnected(false);
        setIsVerifying(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('verify-drive-connection', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Drive verification error:', error);
        setIsConnected(false);
      } else {
        setIsConnected(data?.connected || false);

        // Show success toast if just connected
        if (data?.connected && !isConnected) {
          toast({
            title: "Google Drive Connected",
            description: "You can now upload images to Google Drive",
          });
        }
      }
    } catch (error) {
      console.error('Error verifying Drive connection:', error);
      setIsConnected(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Save form data to sessionStorage before OAuth redirect
      if (formData) {
        sessionStorage.setItem('storeSetupFormData', JSON.stringify(formData));
      }

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
      <div className={`flex items-center justify-between p-4 rounded-lg border ${isConnected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border bg-card'}`}>
        <div className="flex items-center gap-3">
          <HardDrive className={`w-5 h-5 ${isConnected ? 'text-green-600' : 'text-primary'}`} />
          <div>
            <p className={`font-medium text-sm ${isConnected ? 'text-green-700 dark:text-green-400' : ''}`}>Google Drive</p>
            <p className={`text-xs ${isConnected ? 'text-green-600 dark:text-green-500 font-medium' : 'text-muted-foreground'}`}>
              {isVerifying ? "Checking..." : isConnected ? "✓ Connected" : "Not connected"}
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
    <Card className={`admin-card ${!isConnected ? 'border-red-500 border-2' : 'border-green-500 border-2'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10' : 'bg-primary/10'}`}>
            <HardDrive className={`w-5 h-5 ${isConnected ? 'text-green-600' : 'text-primary'}`} />
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
        <div className={`flex items-center justify-between p-4 rounded-lg border ${isConnected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border bg-muted/50'}`}>
          <div className="space-y-1">
            <p className={`font-medium text-sm ${isConnected ? 'text-green-700 dark:text-green-400' : ''}`}>
              {isVerifying ? "Checking..." : isConnected ? "✓ Connected" : "Not Connected"}
            </p>
            <p className={`text-xs ${isConnected ? 'text-green-600 dark:text-green-500' : 'text-muted-foreground'}`}>
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
