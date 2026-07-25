export interface GstSettings {
  enabled: boolean;
  gstin?: string | null;
  rate: number;
  priceIncludesTax: boolean;
  showOnSummary: boolean;
}

export interface GstCalculationInput {
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  gstEnabled: boolean;
  gstRate: number;
  priceIncludesTax: boolean;
}

export interface GstCalculation {
  discountedSubtotal: number;
  taxableAmount: number;
  gstAmount: number;
  deliveryCharge: number;
  total: number;
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const normalizeGstRate = (value: unknown): number => {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 0;
  return Math.min(40, Math.max(0, roundCurrency(rate)));
};

export const isValidGstin = (value: string): boolean => {
  const trimmed = value.trim().toUpperCase();
  return trimmed === "" || GSTIN_REGEX.test(trimmed);
};

export const calculateGst = (input: GstCalculationInput): GstCalculation => {
  const discountedSubtotal = roundCurrency(Math.max(0, input.subtotal - input.discountAmount));
  const deliveryCharge = roundCurrency(Math.max(0, input.deliveryCharge));
  const rate = normalizeGstRate(input.gstRate);

  if (!input.gstEnabled || rate <= 0 || discountedSubtotal <= 0) {
    return {
      discountedSubtotal,
      taxableAmount: discountedSubtotal,
      gstAmount: 0,
      deliveryCharge,
      total: roundCurrency(discountedSubtotal + deliveryCharge),
    };
  }

  if (input.priceIncludesTax) {
    const gstAmount = roundCurrency((discountedSubtotal * rate) / (100 + rate));
    const taxableAmount = roundCurrency(discountedSubtotal - gstAmount);
    return {
      discountedSubtotal,
      taxableAmount,
      gstAmount,
      deliveryCharge,
      total: roundCurrency(discountedSubtotal + deliveryCharge),
    };
  }

  const taxableAmount = discountedSubtotal;
  const gstAmount = roundCurrency((taxableAmount * rate) / 100);
  return {
    discountedSubtotal,
    taxableAmount,
    gstAmount,
    deliveryCharge,
    total: roundCurrency(taxableAmount + gstAmount + deliveryCharge),
  };
};

export const createGstSnapshot = (settings: GstSettings, calculation: GstCalculation) => ({
  enabled: settings.enabled,
  gstin: settings.gstin?.trim().toUpperCase() || null,
  rate: normalizeGstRate(settings.rate),
  price_includes_tax: settings.priceIncludesTax,
  show_on_summary: settings.showOnSummary,
  taxable_amount: calculation.taxableAmount,
  gst_amount: calculation.gstAmount,
  total: calculation.total,
  captured_at: new Date().toISOString(),
});
