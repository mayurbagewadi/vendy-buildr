import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DeleteMyAccountModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  storeName?: string;
}

export function DeleteMyAccountModal({
  open,
  onClose,
  userEmail,
  storeName,
}: DeleteMyAccountModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirmation !== "DELETE") {
      toast({
        title: "Invalid Confirmation",
        description: "Please type DELETE to confirm",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Call edge function to completely delete user including auth records
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete account');
      }

      toast({
        title: "Account Deleted",
        description: "Your account and all associated data have been permanently deleted",
      });

      // Sign out and redirect to home
      await supabase.auth.signOut();

      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete My Account Permanently
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone. All your data will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-100 mb-1">
                ⚠️ Warning: This Cannot Be Undone!
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This action is <strong>permanent and irreversible</strong>. All your data will be completely deleted from our servers.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-semibold text-foreground">The following will be permanently deleted:</p>
            <ul className="text-sm text-muted-foreground space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>Your account</strong> - You will not be able to log in anymore</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>Your store</strong> - {storeName || "Your store"} will be permanently removed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>All products</strong> - Every product you've created</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>All orders</strong> - Complete order history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>Subscription data</strong> - Billing history and subscription info</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>Analytics data</strong> - All performance metrics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold">•</span>
                <span><strong>Uploaded files</strong> - Images, documents, and assets</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Account: <span className="font-bold text-foreground">{userEmail}</span>
            </p>
            {storeName && (
              <p className="text-sm text-muted-foreground">
                Store: <span className="font-semibold">{storeName}</span>
              </p>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="confirmation" className="text-base">
              Type <span className="font-bold text-destructive text-lg">DELETE</span> to confirm permanent deletion
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type DELETE here"
              className="text-center font-semibold text-lg"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmation !== "DELETE" || loading}
            className="flex-1"
          >
            {loading ? "Deleting Forever..." : "Delete My Account Forever"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
