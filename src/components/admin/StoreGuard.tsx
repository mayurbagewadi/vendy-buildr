import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface StoreGuardProps {
  children: React.ReactNode;
}

type GuardStatus = "loading" | "ok" | "deleted";

export function StoreGuard({ children }: StoreGuardProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GuardStatus>("loading");
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkStore = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.log('[StoreGuard] No session - redirecting to auth');
          navigate("/auth", { replace: true });
          return;
        }

        console.log('[StoreGuard] Session found, checking store...');

        // Check if store exists for this user
        const { data: store, error } = await supabase
          .from("stores")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        // If effect was cancelled, don't update state
        if (cancelled) return;

        if (error) {
          console.error('[StoreGuard] Error checking store:', error);
          setStatus("deleted");
          setHasChecked(true);
          return;
        }

        if (!store) {
          console.log('[StoreGuard] Store not found - store was deleted');
          setStatus("deleted");
          setHasChecked(true);
          return;
        }

        console.log('[StoreGuard] Store found - access granted');
        setStatus("ok");
        setHasChecked(true);
      } catch (error) {
        console.error('[StoreGuard] Error in checkStore:', error);
        if (!cancelled) {
          setStatus("deleted");
          setHasChecked(true);
        }
      }
    };

    checkStore();

    // Cleanup: mark as cancelled if component unmounts
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading your store...</p>
        </div>
      </div>
    );
  }

  // Store deleted state
  if (status === "deleted" && hasChecked) {
    return (
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-red-100 p-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold">
              Your Store Has Been Deleted
            </DialogTitle>
            <DialogDescription className="text-center pt-4">
              Your store has been deleted by the platform admin. You will be redirected to create a new store or you can logout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 flex flex-col pt-4">
            <Button
              onClick={() => {
                navigate("/onboarding/store-setup", { replace: true });
              }}
              className="w-full"
            >
              Create New Store
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth", { replace: true });
              }}
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Store exists - render children
  if (status === "ok") {
    return <>{children}</>;
  }

  return null;
}

export default StoreGuard;
