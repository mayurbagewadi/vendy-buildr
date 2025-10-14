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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

interface SuspendAccountModalProps {
  user: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SuspendAccountModal({
  user,
  open,
  onClose,
  onSuccess,
}: SuspendAccountModalProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuspend = async () => {
    try {
      setLoading(true);

      // Update user status to suspended
      const { error } = await supabase
        .from("profiles")
        .update({ status: "suspended" })
        .eq("user_id", user.id);

      if (error) throw error;

      // Activity logging will be implemented in future update

      toast({
        title: "Account Suspended",
        description: `${user.email}'s account has been suspended`,
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
          <DialogTitle>Suspend Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Warning
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Suspending this account will prevent the user from logging in and make
                their store inaccessible.
              </p>
            </div>
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
            <Label htmlFor="reason">Reason for Suspension</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="violation">Policy Violation</SelectItem>
                <SelectItem value="non-payment">Non-payment</SelectItem>
                <SelectItem value="fraud">Fraudulent Activity</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this suspension..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSuspend}
            disabled={!reason || loading}
          >
            {loading ? "Suspending..." : "Confirm Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
