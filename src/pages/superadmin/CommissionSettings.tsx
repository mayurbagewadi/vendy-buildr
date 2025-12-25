import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Save, Plus, Info, ChevronDown, History, Calendar, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CommissionConfig {
  model: "onetime" | "recurring" | "hybrid";
  onetimeType: "percentage" | "fixed";
  onetimeValue: number;
  recurringType: "percentage" | "fixed";
  recurringValue: number;
  recurringDuration: number;
}

interface PlanCommissionOverride {
  enabled: boolean;
  monthly: CommissionConfig;
  yearly: CommissionConfig;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number;
  is_active: boolean;
}

interface AuditRecord {
  id: string;
  created_at: string;
  changed_by_email: string;
  action: string;
  table_name: string;
  field_changed?: string;
  old_value?: any;
  new_value?: any;
  change_reason?: string;
}

export default function SuperAdminCommissionSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Network Commission Settings - Consolidated
  const [networkMonthly, setNetworkMonthly] = useState<CommissionConfig>({
    model: "recurring",
    onetimeType: "percentage",
    onetimeValue: 0,
    recurringType: "percentage",
    recurringValue: 0,
    recurringDuration: 12
  });

  const [networkYearly, setNetworkYearly] = useState<CommissionConfig>({
    model: "recurring",
    onetimeType: "percentage",
    onetimeValue: 0,
    recurringType: "percentage",
    recurringValue: 0,
    recurringDuration: 12
  });

  // Active subscription type tab
  const [activeSubscriptionTab, setActiveSubscriptionTab] = useState<"monthly" | "yearly">("monthly");

  // Subscription Plans (fetched from database)
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);

  // Plan-Specific Commission (initialized after fetching subscription plans)
  const [planCommissions, setPlanCommissions] = useState<Record<string, PlanCommissionOverride>>({});

  // Feature Toggles
  const [enableMultiTier, setEnableMultiTier] = useState(true);
  const [autoApproveApplications, setAutoApproveApplications] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [sendCommissionNotifications, setSendCommissionNotifications] = useState(true);

  // Payment Settings
  const [minPayoutThreshold, setMinPayoutThreshold] = useState(500);
  const [paymentSchedule, setPaymentSchedule] = useState("monthly");
  const [paymentDay, setPaymentDay] = useState("1st");


  // Helper Recruitment Settings
  const [maxHelpersPerRecruiter, setMaxHelpersPerRecruiter] = useState(-1); // -1 = unlimited
  const [referralCodePrefix, setReferralCodePrefix] = useState("HELP");
  const [autoGenerateCodes, setAutoGenerateCodes] = useState(true);

  // Audit Trail
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Helper Functions for Plan-Specific Commission
  const togglePlanCommission = (planId: string) => {
    setPlanCommissions(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        enabled: !prev[planId].enabled
      }
    }));
  };

  const updatePlanCommission = (planId: string, subscriptionType: "monthly" | "yearly", field: string, value: any) => {
    setPlanCommissions(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [subscriptionType]: {
          ...prev[planId][subscriptionType],
          [field]: value
        }
      }
    }));
  };

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const session = sessionStorage.getItem('superadmin_session');
      if (!session) {
        navigate('/superadmin/login');
        return;
      }

      await loadSettings();
      setLoading(false);
    } catch (error) {
      console.error("Error checking super admin access:", error);
      navigate('/superadmin/login');
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, slug, monthly_price, yearly_price, is_active')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      const plans = data || [];
      setSubscriptionPlans(plans);

      // Initialize plan commissions for fetched plans
      const initialCommissions: Record<string, PlanCommissionOverride> = {};
      plans.forEach(plan => {
        initialCommissions[plan.id] = {
          enabled: false,
          monthly: { model: "hybrid", onetimeType: "percentage", onetimeValue: 0, recurringType: "percentage", recurringValue: 0, recurringDuration: 12 },
          yearly: { model: "hybrid", onetimeType: "percentage", onetimeValue: 0, recurringType: "percentage", recurringValue: 0, recurringDuration: 12 }
        };
      });
      setPlanCommissions(initialCommissions);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      toast.error("Failed to load subscription plans");
    }
  };

  const fetchAuditRecords = async () => {
    try {
      // Note: This will work once the database migration is applied
      const { data, error } = await supabase
        .from('commission_settings_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Show last 50 changes

      if (error) {
        // If table doesn't exist yet (migration not applied), show friendly message
        if (error.message.includes('does not exist')) {
          console.info('Audit trail table not yet created');
          setAuditRecords([]);
          return;
        }
        throw error;
      }

      setAuditRecords(data || []);
    } catch (error) {
      console.error("Error fetching audit records:", error);
      // Don't show error toast if table doesn't exist yet
      if (!String(error).includes('does not exist')) {
        toast.error("Failed to load audit trail");
      }
    }
  };

  const loadSettings = async () => {
    // Fetch subscription plans from database
    await fetchSubscriptionPlans();
    // In a real implementation, load commission settings from database
    toast.success("Settings loaded");
  };

  const validateSettings = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // 1. Validate Network Commission - Monthly
    if (networkMonthly.model === "onetime" || networkMonthly.model === "hybrid") {
      if (networkMonthly.onetimeType === "percentage" && (networkMonthly.onetimeValue < 0 || networkMonthly.onetimeValue > 100)) {
        errors.push("Network Monthly: One-time percentage must be between 0-100%");
      }
      if (networkMonthly.onetimeType === "fixed" && networkMonthly.onetimeValue < 0) {
        errors.push("Network Monthly: One-time fixed amount cannot be negative");
      }
    }

    if (networkMonthly.model === "recurring" || networkMonthly.model === "hybrid") {
      if (networkMonthly.recurringType === "percentage" && (networkMonthly.recurringValue < 0 || networkMonthly.recurringValue > 100)) {
        errors.push("Network Monthly: Recurring percentage must be between 0-100%");
      }
      if (networkMonthly.recurringType === "fixed" && networkMonthly.recurringValue < 0) {
        errors.push("Network Monthly: Recurring fixed amount cannot be negative");
      }
      if (networkMonthly.recurringDuration < 1 || networkMonthly.recurringDuration > 24) {
        errors.push("Network Monthly: Duration must be between 1-24 months");
      }
    }

    // 2. Validate Network Commission - Yearly
    if (networkYearly.model === "onetime" || networkYearly.model === "hybrid") {
      if (networkYearly.onetimeType === "percentage" && (networkYearly.onetimeValue < 0 || networkYearly.onetimeValue > 100)) {
        errors.push("Network Yearly: One-time percentage must be between 0-100%");
      }
      if (networkYearly.onetimeType === "fixed" && networkYearly.onetimeValue < 0) {
        errors.push("Network Yearly: One-time fixed amount cannot be negative");
      }
    }

    if (networkYearly.model === "recurring" || networkYearly.model === "hybrid") {
      if (networkYearly.recurringType === "percentage" && (networkYearly.recurringValue < 0 || networkYearly.recurringValue > 100)) {
        errors.push("Network Yearly: Recurring percentage must be between 0-100%");
      }
      if (networkYearly.recurringType === "fixed" && networkYearly.recurringValue < 0) {
        errors.push("Network Yearly: Recurring fixed amount cannot be negative");
      }
      if (networkYearly.recurringDuration < 1 || networkYearly.recurringDuration > 24) {
        errors.push("Network Yearly: Duration must be between 1-24 months");
      }
    }

    // 3. Validate Plan-Specific Commissions
    Object.entries(planCommissions).forEach(([planId, commission]) => {
      if (commission.enabled) {
        const plan = subscriptionPlans.find(p => p.id === planId);
        const planName = plan?.name || "Unknown Plan";

        // Validate Monthly
        if (commission.monthly.model === "onetime" || commission.monthly.model === "hybrid") {
          if (commission.monthly.onetimeType === "percentage" &&
              (commission.monthly.onetimeValue < 0 || commission.monthly.onetimeValue > 100)) {
            errors.push(`${planName} (Monthly): One-time percentage must be between 0-100%`);
          }
          if (commission.monthly.onetimeType === "fixed" && commission.monthly.onetimeValue < 0) {
            errors.push(`${planName} (Monthly): One-time fixed amount cannot be negative`);
          }
        }

        if (commission.monthly.model === "recurring" || commission.monthly.model === "hybrid") {
          if (commission.monthly.recurringType === "percentage" &&
              (commission.monthly.recurringValue < 0 || commission.monthly.recurringValue > 100)) {
            errors.push(`${planName} (Monthly): Recurring percentage must be between 0-100%`);
          }
          if (commission.monthly.recurringType === "fixed" && commission.monthly.recurringValue < 0) {
            errors.push(`${planName} (Monthly): Recurring fixed amount cannot be negative`);
          }
          if (commission.monthly.recurringDuration < 1 || commission.monthly.recurringDuration > 24) {
            errors.push(`${planName} (Monthly): Duration must be between 1-24 months`);
          }
        }

        // Validate Yearly
        if (commission.yearly.model === "onetime" || commission.yearly.model === "hybrid") {
          if (commission.yearly.onetimeType === "percentage" &&
              (commission.yearly.onetimeValue < 0 || commission.yearly.onetimeValue > 100)) {
            errors.push(`${planName} (Yearly): One-time percentage must be between 0-100%`);
          }
          if (commission.yearly.onetimeType === "fixed" && commission.yearly.onetimeValue < 0) {
            errors.push(`${planName} (Yearly): One-time fixed amount cannot be negative`);
          }
        }

        if (commission.yearly.model === "recurring" || commission.yearly.model === "hybrid") {
          if (commission.yearly.recurringType === "percentage" &&
              (commission.yearly.recurringValue < 0 || commission.yearly.recurringValue > 100)) {
            errors.push(`${planName} (Yearly): Recurring percentage must be between 0-100%`);
          }
          if (commission.yearly.recurringType === "fixed" && commission.yearly.recurringValue < 0) {
            errors.push(`${planName} (Yearly): Recurring fixed amount cannot be negative`);
          }
          if (commission.yearly.recurringDuration < 1 || commission.yearly.recurringDuration > 24) {
            errors.push(`${planName} (Yearly): Duration must be between 1-24 months`);
          }
        }

        // Warn if enabled but all values are 0
        const hasMonthlyValue = (commission.monthly.model === "onetime" && commission.monthly.onetimeValue > 0) ||
                                (commission.monthly.model === "recurring" && commission.monthly.recurringValue > 0) ||
                                (commission.monthly.model === "hybrid" && (commission.monthly.onetimeValue > 0 || commission.monthly.recurringValue > 0));

        const hasYearlyValue = (commission.yearly.model === "onetime" && commission.yearly.onetimeValue > 0) ||
                               (commission.yearly.model === "recurring" && commission.yearly.recurringValue > 0) ||
                               (commission.yearly.model === "hybrid" && (commission.yearly.onetimeValue > 0 || commission.yearly.recurringValue > 0));

        if (!hasMonthlyValue && !hasYearlyValue) {
          errors.push(`${planName}: Commission is enabled but all values are 0 - helpers will not earn anything`);
        }
      }
    });

    // 4. Validate System Configuration
    if (minPayoutThreshold < 0) {
      errors.push("Minimum Payout Threshold cannot be negative");
    }

    if (!referralCodePrefix || referralCodePrefix.trim() === "") {
      errors.push("Referral Code Prefix cannot be empty");
    }

    if (referralCodePrefix.length > 6) {
      errors.push("Referral Code Prefix must be 6 characters or less");
    }

    if (maxHelpersPerRecruiter < -1) {
      errors.push("Max Helpers Per Recruiter must be -1 (unlimited) or a positive number");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSaveSettings = async () => {
    // Validate before saving
    const validation = validateSettings();

    if (!validation.isValid) {
      // Show all validation errors
      validation.errors.forEach((error, index) => {
        setTimeout(() => {
          toast.error(error, { duration: 5000 });
        }, index * 100); // Stagger the toasts slightly
      });
      return; // Don't proceed with save
    }

    setSaving(true);
    try {
      // In a real implementation, save to database
      // For now, just show success message

      const settings = {
        network_commission: {
          monthly: {
            model: networkMonthly.model,
            onetime: {
              type: networkMonthly.onetimeType,
              value: networkMonthly.onetimeValue
            },
            recurring: {
              type: networkMonthly.recurringType,
              value: networkMonthly.recurringValue,
              duration_months: networkMonthly.recurringDuration
            }
          },
          yearly: {
            model: networkYearly.model,
            onetime: {
              type: networkYearly.onetimeType,
              value: networkYearly.onetimeValue
            },
            recurring: {
              type: networkYearly.recurringType,
              value: networkYearly.recurringValue,
              duration_months: networkYearly.recurringDuration
            }
          }
        },
        plan_commissions: planCommissions,
        features: {
          enable_multi_tier: enableMultiTier,
          auto_approve_applications: autoApproveApplications,
          send_welcome_email: sendWelcomeEmail,
          send_commission_notifications: sendCommissionNotifications
        },
        payment: {
          min_payout_threshold: minPayoutThreshold,
          payment_schedule: paymentSchedule,
          payment_day: paymentDay
        },
        recruitment: {
          max_helpers_per_recruiter: maxHelpersPerRecruiter,
          referral_code_prefix: referralCodePrefix,
          auto_generate_codes: autoGenerateCodes
        }
      };

      console.log("Settings to save:", settings);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success("Settings saved successfully!");
      setSaving(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Duration options
  const durationOptions = [
    { label: "1 month", value: 1 },
    { label: "3 months", value: 3 },
    { label: "6 months", value: 6 },
    { label: "12 months", value: 12 },
    { label: "24 months", value: 24 },
  ];

  // Calculate example earnings
  const exampleMonthlySubscription = 100;
  const exampleYearlySubscription = 1000;

  const calculateNetworkCommission = (month: number, isYearly: boolean = false) => {
    const subscription = isYearly ? exampleYearlySubscription : exampleMonthlySubscription;
    const config = isYearly ? networkYearly : networkMonthly;

    if (config.model === "onetime") {
      return month === 1 ? (config.onetimeType === "percentage" ? (subscription * config.onetimeValue) / 100 : config.onetimeValue) : 0;
    } else if (config.model === "recurring") {
      return month <= config.recurringDuration ? (config.recurringType === "percentage" ? (subscription * config.recurringValue) / 100 : config.recurringValue) : 0;
    } else {
      const onetime = month === 1 ? (config.onetimeType === "percentage" ? (subscription * config.onetimeValue) / 100 : config.onetimeValue) : 0;
      const recurring = month > 1 && month <= config.recurringDuration + 1 ? (config.recurringType === "percentage" ? (subscription * config.recurringValue) / 100 : config.recurringValue) : 0;
      return onetime + recurring;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Commission Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure commission rates, payment settings, and helper program rules
            </p>
          </div>
          <Button onClick={() => navigate("/superadmin/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* Network Commission Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Network Commission Settings</CardTitle>
            <CardDescription>Commission when helper recruits a another helper (multi-tier)</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="monthly" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="monthly">Monthly Subscription</TabsTrigger>
                <TabsTrigger value="yearly">Yearly Subscription</TabsTrigger>
              </TabsList>

              {/* MONTHLY SUBSCRIPTION TAB */}
              <TabsContent value="monthly" className="space-y-6">
                {/* Model Selector */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Commission Model</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="network-monthly-onetime"
                        name="network-monthly-model"
                        checked={networkMonthly.model === "onetime"}
                        onChange={() => setNetworkMonthly(prev => ({ ...prev, model: "onetime" }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="network-monthly-onetime" className="font-normal cursor-pointer">
                        Model 1: One-time Commission Only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="network-monthly-recurring"
                        name="network-monthly-model"
                        checked={networkMonthly.model === "recurring"}
                        onChange={() => setNetworkMonthly(prev => ({ ...prev, model: "recurring" }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="network-monthly-recurring" className="font-normal cursor-pointer">
                        Model 2: Recurring Commission Only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="network-monthly-hybrid"
                        name="network-monthly-model"
                        checked={networkMonthly.model === "hybrid"}
                        onChange={() => setNetworkMonthly(prev => ({ ...prev, model: "hybrid" }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="network-monthly-hybrid" className="font-normal cursor-pointer">
                        Model 3: Onboarding + Recurring (Hybrid)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* One-time Commission */}
                {(networkMonthly.model === "onetime" || networkMonthly.model === "hybrid") && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">One-time Network Commission</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Commission Type</Label>
                        <Select value={networkMonthly.onetimeType} onValueChange={(v: "percentage" | "fixed") => setNetworkMonthly(prev => ({ ...prev, onetimeType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{networkMonthly.onetimeType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                        <Input
                          type="number"
                          value={networkMonthly.onetimeValue}
                          onChange={(e) => setNetworkMonthly(prev => ({ ...prev, onetimeValue: e.target.value === "" ? 0 : Number(e.target.value) }))}
                          min={0}
                          max={networkMonthly.onetimeType === "percentage" ? 100 : undefined}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paid when store completes onboarding and first subscription payment
                    </p>
                  </div>
                )}

                {/* Recurring Network Commission */}
                {(networkMonthly.model === "recurring" || networkMonthly.model === "hybrid") && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Recurring Network Commission</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Commission Type</Label>
                        <Select value={networkMonthly.recurringType} onValueChange={(v: "percentage" | "fixed") => setNetworkMonthly(prev => ({ ...prev, recurringType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{networkMonthly.recurringType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                        <Input
                          type="number"
                          value={networkMonthly.recurringValue}
                          onChange={(e) => setNetworkMonthly(prev => ({ ...prev, recurringValue: e.target.value === "" ? 0 : Number(e.target.value) }))}
                          min={0}
                          max={networkMonthly.recurringType === "percentage" ? 100 : undefined}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration (Months)</Label>
                        <Select value={networkMonthly.recurringDuration.toString()} onValueChange={(v) => setNetworkMonthly(prev => ({ ...prev, recurringDuration: parseInt(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {durationOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paid monthly for the specified duration while store remains active
                    </p>
                  </div>
                )}

                {/* Preview */}
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                        Earnings Preview (Store pays ₹{exampleMonthlySubscription}/month):
                      </p>
                      <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        <p>• Month 1: ₹{calculateNetworkCommission(1, false).toFixed(2)}</p>
                        <p>• Month 2: ₹{calculateNetworkCommission(2, false).toFixed(2)}</p>
                        <p>• Month 12: ₹{calculateNetworkCommission(12, false).toFixed(2)}</p>
                        {networkMonthly.recurringDuration > 12 && (
                          <p>• Month {networkMonthly.recurringDuration + 1}: ₹{calculateNetworkCommission(networkMonthly.recurringDuration + 1, false).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* YEARLY SUBSCRIPTION TAB */}
              <TabsContent value="yearly" className="space-y-6">
                {/* Model Selector */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Commission Model</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="network-yearly-onetime"
                        name="network-yearly-model"
                        checked={networkYearly.model === "onetime"}
                        onChange={() => setNetworkYearly(prev => ({ ...prev, model: "onetime" }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="network-yearly-onetime" className="font-normal cursor-pointer">
                        Model 1: One-time Commission Only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="network-yearly-recurring"
                        name="network-yearly-model"
                        checked={networkYearly.model === "recurring"}
                        onChange={() => setNetworkYearly(prev => ({ ...prev, model: "recurring" }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="network-yearly-recurring" className="font-normal cursor-pointer">
                        Model 2: Recurring Commission Only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="network-yearly-hybrid"
                        name="network-yearly-model"
                        checked={networkYearly.model === "hybrid"}
                        onChange={() => setNetworkYearly(prev => ({ ...prev, model: "hybrid" }))}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="network-yearly-hybrid" className="font-normal cursor-pointer">
                        Model 3: Onboarding + Recurring (Hybrid)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* One-time Commission */}
                {(networkYearly.model === "onetime" || networkYearly.model === "hybrid") && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">One-time Network Commission</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Commission Type</Label>
                        <Select value={networkYearly.onetimeType} onValueChange={(v: "percentage" | "fixed") => setNetworkYearly(prev => ({ ...prev, onetimeType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{networkYearly.onetimeType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                        <Input
                          type="number"
                          value={networkYearly.onetimeValue}
                          onChange={(e) => setStoreYearlyOnetimeValue(e.target.value === "" ? 0 : Number(e.target.value))}
                          min={0}
                          max={networkYearly.onetimeType === "percentage" ? 100 : undefined}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paid when store purchases yearly subscription (higher to incentivize yearly sales)
                    </p>
                  </div>
                )}

                {/* Recurring Network Commission */}
                {(networkYearly.model === "recurring" || networkYearly.model === "hybrid") && (
                  <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                    <Label className="text-base font-semibold">Recurring Network Commission</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Commission Type</Label>
                        <Select value={networkYearly.recurringType} onValueChange={(v: "percentage" | "fixed") => setNetworkYearly(prev => ({ ...prev, recurringType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{networkYearly.recurringType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                        <Input
                          type="number"
                          value={networkYearly.recurringValue}
                          onChange={(e) => setStoreYearlyRecurringValue(e.target.value === "" ? 0 : Number(e.target.value))}
                          min={0}
                          max={networkYearly.recurringType === "percentage" ? 100 : undefined}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration (Years)</Label>
                        <Select value={networkYearly.recurringDuration.toString()} onValueChange={(v) => setNetworkYearly(prev => ({ ...prev, recurringDuration: parseInt(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {durationOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label} {opt.value > 1 ? "years" : "year"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paid yearly for the specified duration while store renews subscription
                    </p>
                  </div>
                )}

                {/* Preview */}
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                        Earnings Preview (Store pays ₹{exampleYearlySubscription}/year):
                      </p>
                      <div className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                        <p>• Year 1: ₹{calculateNetworkCommission(1, true).toFixed(2)}</p>
                        <p>• Year 2: ₹{calculateNetworkCommission(2, true).toFixed(2)}</p>
                        <p>• Year 12: ₹{calculateNetworkCommission(12, true).toFixed(2)}</p>
                        {networkYearly.recurringDuration > 12 && (
                          <p>• Year {networkYearly.recurringDuration + 1}: ₹{calculateNetworkCommission(networkYearly.recurringDuration + 1, true).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        {/* Plan-Specific Commission */}
        <Card>
          <CardHeader>
            <CardTitle>Plan-Specific Commission</CardTitle>
            <CardDescription>
              Customize commission rates for specific subscription plans.
              When disabled, global settings apply.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {subscriptionPlans.map((plan) => {
                const commission = planCommissions[plan.id];
                return (
                  <AccordionItem key={plan.id} value={plan.id}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold ${!commission.enabled ? "text-red-600 dark:text-red-400" : ""}`}>
                            {plan.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ₹{plan.monthly_price}/month • ₹{plan.yearly_price}/year
                          </span>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={commission.enabled}
                            onCheckedChange={() => togglePlanCommission(plan.id)}
                          />
                          <span className={`text-sm ${!commission.enabled ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                            {commission.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {!commission.enabled ? (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                          <p className="text-red-900 dark:text-red-100 font-semibold">
                            ⚠️ Commission Disabled
                          </p>
                          <p className="text-red-700 dark:text-red-300 text-sm mt-2">
                            Helpers will receive <strong>NO commission</strong> for recruiting store owners on this plan.
                            Enable commission above to set rates.
                          </p>
                        </div>
                      ) : (
                        <Tabs defaultValue="monthly" className="w-full">
                          <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="monthly">Monthly Subscription</TabsTrigger>
                            <TabsTrigger value="yearly">Yearly Subscription</TabsTrigger>
                          </TabsList>

                          {/* MONTHLY TAB */}
                          <TabsContent value="monthly" className="space-y-4">
                            {/* Model Selector */}
                            <div className="space-y-2">
                              <Label className="font-semibold">Commission Model</Label>
                              <div className="space-y-2">
                                {["onetime", "recurring", "hybrid"].map((model) => (
                                  <div key={model} className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      id={`${plan.id}-monthly-${model}`}
                                      name={`${plan.id}-monthly-model`}
                                      checked={commission.monthly.model === model}
                                      onChange={() => updatePlanCommission(plan.id, "monthly", "model", model)}
                                      className="h-4 w-4"
                                    />
                                    <Label htmlFor={`${plan.id}-monthly-${model}`} className="font-normal cursor-pointer">
                                      Model {model === "onetime" ? "1" : model === "recurring" ? "2" : "3"}:
                                      {model === "onetime" ? " One-time Only" : model === "recurring" ? " Recurring Only" : " Hybrid"}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Onboarding Commission */}
                            {(commission.monthly.model === "onetime" || commission.monthly.model === "hybrid") && (
                              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                                <Label className="font-semibold">Onboarding Commission</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                      value={commission.monthly.onetimeType}
                                      onValueChange={(v: "percentage" | "fixed") => updatePlanCommission(plan.id, "monthly", "onetimeType", v)}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{commission.monthly.onetimeType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                                    <Input
                                      type="number"
                                      value={commission.monthly.onetimeValue}
                                      onChange={(e) => updatePlanCommission(plan.id, "monthly", "onetimeValue", e.target.value === "" ? 0 : Number(e.target.value))}
                                      min={0}
                                      max={commission.monthly.onetimeType === "percentage" ? 100 : undefined}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Recurring Commission */}
                            {(commission.monthly.model === "recurring" || commission.monthly.model === "hybrid") && (
                              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                                <Label className="font-semibold">Recurring Commission</Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                      value={commission.monthly.recurringType}
                                      onValueChange={(v: "percentage" | "fixed") => updatePlanCommission(plan.id, "monthly", "recurringType", v)}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{commission.monthly.recurringType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                                    <Input
                                      type="number"
                                      value={commission.monthly.recurringValue}
                                      onChange={(e) => updatePlanCommission(plan.id, "monthly", "recurringValue", e.target.value === "" ? 0 : Number(e.target.value))}
                                      min={0}
                                      max={commission.monthly.recurringType === "percentage" ? 100 : undefined}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Duration (Months)</Label>
                                    <Select
                                      value={commission.monthly.recurringDuration.toString()}
                                      onValueChange={(v) => updatePlanCommission(plan.id, "monthly", "recurringDuration", parseInt(v))}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {durationOptions.map(opt => (
                                          <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </TabsContent>

                          {/* YEARLY TAB */}
                          <TabsContent value="yearly" className="space-y-4">
                            {/* Model Selector */}
                            <div className="space-y-2">
                              <Label className="font-semibold">Commission Model</Label>
                              <div className="space-y-2">
                                {["onetime", "recurring", "hybrid"].map((model) => (
                                  <div key={model} className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      id={`${plan.id}-yearly-${model}`}
                                      name={`${plan.id}-yearly-model`}
                                      checked={commission.yearly.model === model}
                                      onChange={() => updatePlanCommission(plan.id, "yearly", "model", model)}
                                      className="h-4 w-4"
                                    />
                                    <Label htmlFor={`${plan.id}-yearly-${model}`} className="font-normal cursor-pointer">
                                      Model {model === "onetime" ? "1" : model === "recurring" ? "2" : "3"}:
                                      {model === "onetime" ? " One-time Only" : model === "recurring" ? " Recurring Only" : " Hybrid"}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Onboarding Commission */}
                            {(commission.yearly.model === "onetime" || commission.yearly.model === "hybrid") && (
                              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                                <Label className="font-semibold">Onboarding Commission</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                      value={commission.yearly.onetimeType}
                                      onValueChange={(v: "percentage" | "fixed") => updatePlanCommission(plan.id, "yearly", "onetimeType", v)}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{commission.yearly.onetimeType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                                    <Input
                                      type="number"
                                      value={commission.yearly.onetimeValue}
                                      onChange={(e) => updatePlanCommission(plan.id, "yearly", "onetimeValue", e.target.value === "" ? 0 : Number(e.target.value))}
                                      min={0}
                                      max={commission.yearly.onetimeType === "percentage" ? 100 : undefined}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Recurring Commission */}
                            {(commission.yearly.model === "recurring" || commission.yearly.model === "hybrid") && (
                              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                                <Label className="font-semibold">Recurring Commission</Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                      value={commission.yearly.recurringType}
                                      onValueChange={(v: "percentage" | "fixed") => updatePlanCommission(plan.id, "yearly", "recurringType", v)}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{commission.yearly.recurringType === "percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                                    <Input
                                      type="number"
                                      value={commission.yearly.recurringValue}
                                      onChange={(e) => updatePlanCommission(plan.id, "yearly", "recurringValue", e.target.value === "" ? 0 : Number(e.target.value))}
                                      min={0}
                                      max={commission.yearly.recurringType === "percentage" ? 100 : undefined}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Duration (Years)</Label>
                                    <Select
                                      value={commission.yearly.recurringDuration.toString()}
                                      onValueChange={(v) => updatePlanCommission(plan.id, "yearly", "recurringDuration", parseInt(v))}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {durationOptions.map(opt => (
                                          <SelectItem key={opt.value} value={opt.value.toString()}>
                                            {opt.label} {opt.value > 1 ? "years" : "year"}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Enable/Disable Features */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Controls</CardTitle>
            <CardDescription>Enable or disable helper program features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Multi-Tier Helper Program</Label>
                <p className="text-xs text-muted-foreground">
                  Allow helpers to recruit other helpers and earn network commissions
                </p>
              </div>
              <Switch checked={enableMultiTier} onCheckedChange={setEnableMultiTier} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-approve Helper Applications</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically approve all helper applications without manual review
                </p>
              </div>
              <Switch checked={autoApproveApplications} onCheckedChange={setAutoApproveApplications} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send Helper Welcome Email</Label>
                <p className="text-xs text-muted-foreground">
                  Send welcome email when helper application is approved
                </p>
              </div>
              <Switch checked={sendWelcomeEmail} onCheckedChange={setSendWelcomeEmail} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send Commission Earned Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Notify helpers when they earn new commissions
                </p>
              </div>
              <Switch checked={sendCommissionNotifications} onCheckedChange={setSendCommissionNotifications} />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Settings</CardTitle>
            <CardDescription>Configure payment schedules and thresholds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Payout Threshold (₹)</Label>
              <Input
                type="number"
                value={minPayoutThreshold}
                onChange={(e) => setMinPayoutThreshold(parseFloat(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Helpers must earn at least this amount before payment is processed
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Schedule</Label>
                <Select value={paymentSchedule} onValueChange={setPaymentSchedule}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Day</Label>
                <Select value={paymentDay} onValueChange={setPaymentDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentSchedule === "weekly" ? (
                      <>
                        <SelectItem value="monday">Every Monday</SelectItem>
                        <SelectItem value="tuesday">Every Tuesday</SelectItem>
                        <SelectItem value="wednesday">Every Wednesday</SelectItem>
                        <SelectItem value="thursday">Every Thursday</SelectItem>
                        <SelectItem value="friday">Every Friday</SelectItem>
                      </>
                    ) : paymentSchedule === "biweekly" ? (
                      <>
                        <SelectItem value="1st-15th">1st and 15th of month</SelectItem>
                        <SelectItem value="monday">Every other Monday</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="1st">1st of month</SelectItem>
                        <SelectItem value="15th">15th of month</SelectItem>
                        <SelectItem value="last">Last day of month</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Helper Recruitment Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Helper Recruitment Settings</CardTitle>
            <CardDescription>Configure helper recruitment rules and referral codes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Maximum Helpers Per Recruiter</Label>
              <Input
                type="number"
                value={maxHelpersPerRecruiter === -1 ? "" : maxHelpersPerRecruiter}
                onChange={(e) => setMaxHelpersPerRecruiter(e.target.value ? parseInt(e.target.value) : -1)}
                placeholder="Leave empty for unlimited"
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty or enter -1 for unlimited recruitment
              </p>
            </div>

            <div className="space-y-2">
              <Label>Referral Code Prefix</Label>
              <Input
                value={referralCodePrefix}
                onChange={(e) => setReferralCodePrefix(e.target.value.toUpperCase())}
                placeholder="HELP"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Prefix for auto-generated referral codes (e.g., HELP001, HELP002)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-generate Referral Codes</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically generate unique referral codes for new helpers
                </p>
              </div>
              <Switch checked={autoGenerateCodes} onCheckedChange={setAutoGenerateCodes} />
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail Viewer */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Audit Trail
                </CardTitle>
                <CardDescription>
                  Track all changes to commission settings
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAuditTrail(!showAuditTrail);
                  if (!showAuditTrail) {
                    fetchAuditRecords();
                  }
                }}
              >
                {showAuditTrail ? "Hide" : "Show"} History
              </Button>
            </div>
          </CardHeader>

          {showAuditTrail && (
            <CardContent>
              {auditRecords.length === 0 ? (
                <div className="bg-muted/50 border border-dashed rounded-lg p-8 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No audit records yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Changes to commission settings will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditRecords.map((record) => (
                    <div
                      key={record.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              record.action === "created"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : record.action === "updated"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : record.action === "deleted"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                            }`}
                          >
                            {record.action.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {record.table_name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(record.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{record.changed_by_email || "Unknown User"}</span>
                      </div>

                      {record.field_changed && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Field:</span>{" "}
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                            {record.field_changed}
                          </span>
                        </div>
                      )}

                      {(record.old_value || record.new_value) && (
                        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                          {record.old_value && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-semibold">Old Value:</p>
                              <pre className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-2 text-xs overflow-auto max-h-32">
                                {JSON.stringify(record.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {record.new_value && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-semibold">New Value:</p>
                              <pre className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 text-xs overflow-auto max-h-32">
                                {JSON.stringify(record.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {record.change_reason && (
                        <div className="mt-3 text-sm">
                          <span className="text-muted-foreground">Reason:</span>{" "}
                          <span className="italic">{record.change_reason}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSaveSettings} disabled={saving}>
            <Save className="h-5 w-5 mr-2" />
            {saving ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
