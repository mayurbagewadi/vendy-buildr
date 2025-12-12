import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

interface DeleteAccountModalProps {
  user: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteAccountModal({
  user,
  open,
  onClose,
  onSuccess,
}: DeleteAccountModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

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

      // Call edge function to completely delete user including auth records
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete user account');
      }

      toast({
        title: "Account Completely Deleted",
        description: `${user.email}'s account, all data, and authentication records have been permanently deleted`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <p className="font-medium text-red-900 dark:text-red-100">
                Permanent Action
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This action cannot be undone. All data will be permanently deleted.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">What will be deleted:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Authentication credentials (cannot login anymore)</li>
              <li>User account and profile</li>
              <li>Store data and settings</li>
              <li>All products</li>
              <li>Subscription history</li>
              <li>All transactions</li>
              <li>Files and assets</li>
            </ul>
          </div>

          <div>
            <p className="text-sm mb-2">
              <strong>User:</strong> {user.email}
            </p>
            {user.store && (
              <p className="text-sm text-muted-foreground">
                <strong>Store:</strong> {user.store.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-bold text-destructive">DELETE</span> to
              confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type DELETE here"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmation !== "DELETE" || loading}
          >
            {loading ? "Deleting..." : "Permanently Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
