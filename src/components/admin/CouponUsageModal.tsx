import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { getCouponUsageDetails, type CouponUsageRecord } from "@/lib/couponUtils";

interface CouponUsageModalProps {
  couponCode: string;
  couponId: string;
  open: boolean;
  onClose: () => void;
}

export function CouponUsageModal({
  couponCode,
  couponId,
  open,
  onClose,
}: CouponUsageModalProps) {
  const [usageRecords, setUsageRecords] = useState<CouponUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && couponId) {
      loadUsageDetails();
    }
  }, [open, couponId]);

  const loadUsageDetails = async () => {
    setIsLoading(true);
    try {
      const records = await getCouponUsageDetails(couponId);
      setUsageRecords(records);
    } catch (error) {
      console.error("Error loading usage details:", error);
      setUsageRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Coupon Usage - {couponCode}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : usageRecords.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No usage records for this coupon yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer Phone</TableHead>
                  <TableHead>Customer Email</TableHead>
                  <TableHead>Discount Applied</TableHead>
                  <TableHead>Used At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.order_number || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.customer_phone || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.customer_email || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      ₹{record.discount_applied.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(record.used_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
