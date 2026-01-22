/**
 * Enterprise-level Marketplace Payment Modal
 * Reusable component for handling marketplace feature purchases
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Loader2, CreditCard, Zap, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  MarketplaceFeature,
  PricingOption,
  PricingType,
  getFeaturePricingOptions,
  purchaseMarketplaceFeature,
} from '@/lib/marketplace/paymentService';

interface MarketplacePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: MarketplaceFeature;
  storeId: string;
  userId: string;
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  onSuccess: () => void;
}

export const MarketplacePaymentModal = ({
  open,
  onOpenChange,
  feature,
  storeId,
  userId,
  customerDetails,
  onSuccess,
}: MarketplacePaymentModalProps) => {
  const { toast } = useToast();
  const [selectedPricing, setSelectedPricing] = useState<PricingType | null>(null);
  const [processing, setProcessing] = useState(false);

  const pricingOptions = getFeaturePricingOptions(feature);

  const handlePurchase = async () => {
    if (!selectedPricing) {
      toast({
        title: 'Select a plan',
        description: 'Please select a pricing option to continue',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      const result = await purchaseMarketplaceFeature(
        feature,
        selectedPricing,
        storeId,
        userId,
        customerDetails
      );

      if (result.success) {
        toast({
          title: 'Purchase Successful!',
          description: `${feature.name} has been added to your account`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: 'Purchase Failed',
          description: result.error || 'Unable to complete purchase',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getPricingIcon = (type: PricingType) => {
    switch (type) {
      case 'onetime':
        return <Zap className="h-5 w-5" />;
      case 'monthly':
        return <Calendar className="h-5 w-5" />;
      case 'yearly':
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getPricingBadge = (type: PricingType) => {
    if (type === 'yearly') {
      return <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">Best Value</Badge>;
    }
    if (type === 'onetime') {
      return <Badge variant="secondary" className="ml-2">Lifetime</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Purchase {feature.name}</DialogTitle>
          <DialogDescription className="text-base">
            {feature.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {pricingOptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No pricing options available</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pricingOptions.map((option: PricingOption) => (
                  <Card
                    key={option.type}
                    className={`cursor-pointer transition-all ${
                      selectedPricing === option.type
                        ? 'border-primary border-2 shadow-md'
                        : 'border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPricing(option.type)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`p-2 rounded-lg ${
                              selectedPricing === option.type
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {getPricingIcon(option.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-base">{option.label}</h4>
                              {getPricingBadge(option.type)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {option.description}
                            </p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold">₹{option.price}</span>
                              <span className="text-sm text-muted-foreground">
                                {option.type === 'onetime'
                                  ? 'one-time'
                                  : option.type === 'monthly'
                                  ? '/month'
                                  : '/year'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedPricing === option.type
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {selectedPricing === option.type && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-sm mb-2">What's included:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Full access to {feature.name}</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Regular updates and improvements</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Secure payment via Razorpay</span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!selectedPricing || processing}
            className="min-w-[120px]"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
