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
import { Settings, Save, Plus, Info, ChevronDown, History, Calendar, User, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  // Real-time Field Validation State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Change Summary Modal
  const [showChangeSummary, setShowChangeSummary] = useState(false);
  const [changeSummary, setChangeSummary] = useState<{
    commissionModel: string[];
    commissionRates: string[];
    featureToggles: string[];
    paymentSettings: string[];
    recruitmentSettings: string[];
  }>({
    commissionModel: [],
    commissionRates: [],
    featureToggles: [],
    paymentSettings: [],
    recruitmentSettings: []
  });

  // Original values for comparison
  const [originalValues, setOriginalValues] = useState<any>(null);

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

  // Real-time Field Validation Functions
  const validateField = (fieldName: string, value: any, type?: string) => {
    let error = "";

    switch (fieldName) {
      case "networkMonthlyOnetimeValue":
      case "networkYearlyOnetimeValue":
        if (type === "percentage" && (value < 0 || value > 100)) {
          error = "Percentage must be between 0-100%";
        } else if (type === "fixed" && value < 0) {
          error = "Amount cannot be negative";
        }
        break;

      case "networkMonthlyRecurringValue":
      case "networkYearlyRecurringValue":
        if (type === "percentage" && (value < 0 || value > 100)) {
          error = "Percentage must be between 0-100%";
        } else if (type === "fixed" && value < 0) {
          error = "Amount cannot be negative";
        }
        break;

      case "networkMonthlyRecurringDuration":
      case "networkYearlyRecurringDuration":
        if (value < 1 || value > 24) {
          error = "Duration must be between 1-24 months";
        }
        break;

      case "minPayoutThreshold":
        if (value < 0) {
          error = "Minimum payout cannot be negative";
        }
        break;

      case "referralCodePrefix":
        if (!value || value.trim() === "") {
          error = "Referral code prefix is required";
        } else if (value.length > 6) {
          error = "Prefix must be 6 characters or less";
        }
        break;

      case "maxHelpersPerRecruiter":
        if (value < -1) {
          error = "Value must be -1 (unlimited) or greater";
        }
        break;
    }

    setFieldErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[fieldName] = error;
      } else {
        delete newErrors[fieldName];
      }
      return newErrors;
    });

    return error === "";
  };

  const clearFieldError = (fieldName: string) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
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
        .from('commission_audit')
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
    try {
      // Fetch subscription plans from database
      await fetchSubscriptionPlans();

      // Load active commission settings
      const { data: settings, error: settingsError } = await supabase
        .from('commission_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (settingsError) {
        console.error("Error loading commission settings:", settingsError);
        toast.error("Failed to load commission settings");
        return;
      }

      if (settings) {
        // Load feature toggles
        setEnableMultiTier(settings.enable_multi_tier);
        setAutoApproveApplications(settings.auto_approve_applications);
        setSendWelcomeEmail(settings.send_welcome_email);
        setSendCommissionNotifications(settings.send_commission_notifications);

        // Load payment settings
        setMinPayoutThreshold(settings.min_payout_threshold);
        setPaymentSchedule(settings.payment_schedule);
        setPaymentDay(settings.payment_day);

        // Load recruitment settings
        setMaxHelpersPerRecruiter(settings.max_helpers_per_recruiter);
        setReferralCodePrefix(settings.referral_code_prefix);
        setAutoGenerateCodes(settings.auto_generate_codes);

        // Load network commission settings
        const { data: networkCommissions, error: networkError } = await supabase
          .from('network_commission')
          .select('*')
          .eq('settings_id', settings.id);

        let loadedNetworkMonthly = {
          model: "recurring" as "onetime" | "recurring" | "hybrid",
          onetimeType: "percentage" as "percentage" | "fixed",
          onetimeValue: 0,
          recurringType: "percentage" as "percentage" | "fixed",
          recurringValue: 0,
          recurringDuration: 12
        };

        let loadedNetworkYearly = {
          model: "recurring" as "onetime" | "recurring" | "hybrid",
          onetimeType: "percentage" as "percentage" | "fixed",
          onetimeValue: 0,
          recurringType: "percentage" as "percentage" | "fixed",
          recurringValue: 0,
          recurringDuration: 12
        };

        if (!networkError && networkCommissions) {
          networkCommissions.forEach((nc: any) => {
            const config = {
              model: nc.commission_model as "onetime" | "recurring" | "hybrid",
              onetimeType: nc.onetime_type as "percentage" | "fixed",
              onetimeValue: nc.onetime_value,
              recurringType: nc.recurring_type as "percentage" | "fixed",
              recurringValue: nc.recurring_value,
              recurringDuration: nc.recurring_duration
            };

            if (nc.subscription_type === 'monthly') {
              setNetworkMonthly(config);
              loadedNetworkMonthly = config;
            } else if (nc.subscription_type === 'yearly') {
              setNetworkYearly(config);
              loadedNetworkYearly = config;
            }
          });
        }

        // Load plan-specific commissions
        const { data: planCommissionsData, error: planError } = await supabase
          .from('plan_commission')
          .select('*')
          .eq('settings_id', settings.id);

        let loadedPlanCommissions: Record<string, PlanCommissionOverride> = {};

        if (!planError && planCommissionsData) {
          // Start with existing initialized commissions (from fetchSubscriptionPlans)
          // Get current state by creating a copy
          const currentPlans: Record<string, PlanCommissionOverride> = {};

          // Initialize with default values for all subscription plans
          subscriptionPlans.forEach(plan => {
            currentPlans[plan.id] = {
              enabled: false,
              monthly: { model: "hybrid", onetimeType: "percentage", onetimeValue: 0, recurringType: "percentage", recurringValue: 0, recurringDuration: 12 },
              yearly: { model: "hybrid", onetimeType: "percentage", onetimeValue: 0, recurringType: "percentage", recurringValue: 0, recurringDuration: 12 }
            };
          });

          planCommissionsData.forEach((pc: any) => {
            if (!currentPlans[pc.plan_id]) {
              currentPlans[pc.plan_id] = {
                enabled: pc.enabled,
                monthly: { model: "hybrid", onetimeType: "percentage", onetimeValue: 0, recurringType: "percentage", recurringValue: 0, recurringDuration: 12 },
                yearly: { model: "hybrid", onetimeType: "percentage", onetimeValue: 0, recurringType: "percentage", recurringValue: 0, recurringDuration: 12 }
              };
            }

            const config = {
              model: pc.commission_model as "onetime" | "recurring" | "hybrid",
              onetimeType: pc.onetime_type as "percentage" | "fixed",
              onetimeValue: pc.onetime_value,
              recurringType: pc.recurring_type as "percentage" | "fixed",
              recurringValue: pc.recurring_value,
              recurringDuration: pc.recurring_duration
            };

            if (pc.subscription_type === 'monthly') {
              currentPlans[pc.plan_id].monthly = config;
              currentPlans[pc.plan_id].enabled = pc.enabled;
            } else if (pc.subscription_type === 'yearly') {
              currentPlans[pc.plan_id].yearly = config;
            }
          });

          loadedPlanCommissions = currentPlans;
          setPlanCommissions(currentPlans);
        }

        toast.success("Settings loaded successfully");

        // Save original values for change comparison
        setOriginalValues({
          networkMonthly: loadedNetworkMonthly,
          networkYearly: loadedNetworkYearly,
          planCommissions: JSON.parse(JSON.stringify(loadedPlanCommissions)),
          enableMultiTier: settings.enable_multi_tier,
          autoApproveApplications: settings.auto_approve_applications,
          sendWelcomeEmail: settings.send_welcome_email,
          sendCommissionNotifications: settings.send_commission_notifications,
          minPayoutThreshold: settings.min_payout_threshold,
          paymentSchedule: settings.payment_schedule,
          paymentDay: settings.payment_day,
          maxHelpersPerRecruiter: settings.max_helpers_per_recruiter,
          referralCodePrefix: settings.referral_code_prefix,
          autoGenerateCodes: settings.auto_generate_codes
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    }
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

  // Helper function to clean commission data based on model
  const cleanCommissionData = (model: string, data: any) => {
    const cleaned = { ...data };

    if (model === 'onetime') {
      // Clear recurring values when model is onetime
      // Note: Keep duration at 12 to satisfy database constraint (valid_duration_plan)
      cleaned.recurring_value = 0;
      cleaned.recurring_duration = 12;
    } else if (model === 'recurring') {
      // Clear onetime values when model is recurring
      cleaned.onetime_value = 0;
    }
    // For 'hybrid' model, keep all values

    return cleaned;
  };

  const generateChangeSummary = () => {
    if (!originalValues) return {
      commissionModel: [],
      commissionRates: [],
      featureToggles: [],
      paymentSettings: [],
      recruitmentSettings: []
    };

    const categorizedChanges = {
      commissionModel: [] as string[],
      commissionRates: [] as string[],
      featureToggles: [] as string[],
      paymentSettings: [] as string[],
      recruitmentSettings: [] as string[]
    };

    // Format commission value for display
    const formatCommission = (type: string, value: number) => {
      return type === "percentage" ? `${value}%` : `₹${value}`;
    };

    // Simplified model names
    const modelNames = {
      onetime: "One-time",
      recurring: "Recurring",
      hybrid: "Hybrid"
    };

    // Check Network Monthly changes
    if (JSON.stringify(networkMonthly) !== JSON.stringify(originalValues.networkMonthly)) {
      if (networkMonthly.model !== originalValues.networkMonthly.model) {
        categorizedChanges.commissionModel.push(
          `Monthly: ${modelNames[originalValues.networkMonthly.model]} → ${modelNames[networkMonthly.model]}`
        );
      }
      if (networkMonthly.onetimeValue !== originalValues.networkMonthly.onetimeValue) {
        categorizedChanges.commissionRates.push(
          `Monthly One-time: ${formatCommission(originalValues.networkMonthly.onetimeType, originalValues.networkMonthly.onetimeValue)} → ${formatCommission(networkMonthly.onetimeType, networkMonthly.onetimeValue)}`
        );
      }
      if (networkMonthly.recurringValue !== originalValues.networkMonthly.recurringValue) {
        categorizedChanges.commissionRates.push(
          `Monthly Recurring: ${formatCommission(originalValues.networkMonthly.recurringType, originalValues.networkMonthly.recurringValue)} → ${formatCommission(networkMonthly.recurringType, networkMonthly.recurringValue)}`
        );
      }
      if (networkMonthly.recurringDuration !== originalValues.networkMonthly.recurringDuration) {
        categorizedChanges.commissionRates.push(
          `Monthly Duration: ${originalValues.networkMonthly.recurringDuration} → ${networkMonthly.recurringDuration} months`
        );
      }
    }

    // Check Network Yearly changes
    if (JSON.stringify(networkYearly) !== JSON.stringify(originalValues.networkYearly)) {
      if (networkYearly.model !== originalValues.networkYearly.model) {
        categorizedChanges.commissionModel.push(
          `Yearly: ${modelNames[originalValues.networkYearly.model]} → ${modelNames[networkYearly.model]}`
        );
      }
      if (networkYearly.onetimeValue !== originalValues.networkYearly.onetimeValue) {
        categorizedChanges.commissionRates.push(
          `Yearly One-time: ${formatCommission(originalValues.networkYearly.onetimeType, originalValues.networkYearly.onetimeValue)} → ${formatCommission(networkYearly.onetimeType, networkYearly.onetimeValue)}`
        );
      }
      if (networkYearly.recurringValue !== originalValues.networkYearly.recurringValue) {
        categorizedChanges.commissionRates.push(
          `Yearly Recurring: ${formatCommission(originalValues.networkYearly.recurringType, originalValues.networkYearly.recurringValue)} → ${formatCommission(networkYearly.recurringType, networkYearly.recurringValue)}`
        );
      }
    }

    // Check Plan-specific changes
    Object.keys(planCommissions).forEach(planId => {
      const plan = subscriptionPlans.find(p => p.id === planId);
      if (!plan) return;

      const current = planCommissions[planId];
      const original = originalValues.planCommissions?.[planId];

      if (!original) return;

      if (current.enabled !== original.enabled) {
        categorizedChanges.featureToggles.push(
          `${plan.name}: ${current.enabled ? 'Enabled' : 'Disabled'}`
        );
      }

      if (JSON.stringify(current.monthly) !== JSON.stringify(original.monthly)) {
        if (current.monthly.model !== original.monthly.model) {
          categorizedChanges.commissionModel.push(
            `${plan.name} Monthly: ${modelNames[original.monthly.model]} → ${modelNames[current.monthly.model]}`
          );
        }
        if (current.monthly.onetimeValue !== original.monthly.onetimeValue) {
          categorizedChanges.commissionRates.push(
            `${plan.name} Monthly: ${formatCommission(original.monthly.onetimeType, original.monthly.onetimeValue)} → ${formatCommission(current.monthly.onetimeType, current.monthly.onetimeValue)}`
          );
        }
      }

      if (JSON.stringify(current.yearly) !== JSON.stringify(original.yearly)) {
        if (current.yearly.onetimeValue !== original.yearly.onetimeValue || current.yearly.recurringValue !== original.yearly.recurringValue) {
          categorizedChanges.commissionRates.push(
            `${plan.name} Yearly: Commission updated`
          );
        }
      }
    });

    // Check Feature Toggles
    if (enableMultiTier !== originalValues.enableMultiTier) {
      categorizedChanges.featureToggles.push(
        `Multi-Tier Program: ${enableMultiTier ? 'Enabled' : 'Disabled'}`
      );
    }
    if (autoApproveApplications !== originalValues.autoApproveApplications) {
      categorizedChanges.featureToggles.push(
        `Auto-approve Applications: ${autoApproveApplications ? 'Enabled' : 'Disabled'}`
      );
    }
    if (sendWelcomeEmail !== originalValues.sendWelcomeEmail) {
      categorizedChanges.featureToggles.push(
        `Welcome Email: ${sendWelcomeEmail ? 'Enabled' : 'Disabled'}`
      );
    }
    if (sendCommissionNotifications !== originalValues.sendCommissionNotifications) {
      categorizedChanges.featureToggles.push(
        `Commission Notifications: ${sendCommissionNotifications ? 'Enabled' : 'Disabled'}`
      );
    }

    // Check Payment Settings
    if (minPayoutThreshold !== originalValues.minPayoutThreshold) {
      categorizedChanges.paymentSettings.push(
        `Minimum Payout: ₹${originalValues.minPayoutThreshold} → ₹${minPayoutThreshold}`
      );
    }
    if (paymentSchedule !== originalValues.paymentSchedule) {
      categorizedChanges.paymentSettings.push(
        `Schedule: ${originalValues.paymentSchedule} → ${paymentSchedule}`
      );
    }
    if (paymentDay !== originalValues.paymentDay) {
      categorizedChanges.paymentSettings.push(
        `Payment Day: ${originalValues.paymentDay} → ${paymentDay}`
      );
    }

    // Check Recruitment Settings
    if (maxHelpersPerRecruiter !== originalValues.maxHelpersPerRecruiter) {
      const oldValue = originalValues.maxHelpersPerRecruiter === -1 ? 'Unlimited' : originalValues.maxHelpersPerRecruiter;
      const newValue = maxHelpersPerRecruiter === -1 ? 'Unlimited' : maxHelpersPerRecruiter;
      categorizedChanges.recruitmentSettings.push(
        `Max Helpers: ${oldValue} → ${newValue}`
      );
    }
    if (referralCodePrefix !== originalValues.referralCodePrefix) {
      categorizedChanges.recruitmentSettings.push(
        `Code Prefix: ${originalValues.referralCodePrefix} → ${referralCodePrefix}`
      );
    }

    return categorizedChanges;
  };

  const handleSaveSettings = async () => {
    // Check for real-time field errors
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    if (hasFieldErrors) {
      toast.error("Please fix all field errors before saving", {
        description: "Check the red-highlighted fields above",
        duration: 4000,
      });
      return;
    }

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
      // Get current active settings to deactivate
      const { data: currentSettings } = await supabase
        .from('commission_settings')
        .select('id, version')
        .eq('is_active', true)
        .single();

      const newVersion = currentSettings ? currentSettings.version + 1 : 1;

      // Deactivate current settings
      if (currentSettings) {
        await supabase
          .from('commission_settings')
          .update({ is_active: false })
          .eq('id', currentSettings.id);
      }

      // Insert new commission settings
      const { data: newSettings, error: settingsError } = await supabase
        .from('commission_settings')
        .insert({
          version: newVersion,
          enable_multi_tier: enableMultiTier,
          auto_approve_applications: autoApproveApplications,
          send_welcome_email: sendWelcomeEmail,
          send_commission_notifications: sendCommissionNotifications,
          min_payout_threshold: minPayoutThreshold,
          payment_schedule: paymentSchedule,
          payment_day: paymentDay,
          max_helpers_per_recruiter: maxHelpersPerRecruiter,
          referral_code_prefix: referralCodePrefix,
          auto_generate_codes: autoGenerateCodes,
          is_active: true
        })
        .select()
        .single();

      if (settingsError) throw settingsError;

      // Save network commission - monthly (with cleanup)
      const cleanedNetworkMonthly = cleanCommissionData(networkMonthly.model, {
        onetime_type: networkMonthly.onetimeType,
        onetime_value: networkMonthly.onetimeValue,
        recurring_type: networkMonthly.recurringType,
        recurring_value: networkMonthly.recurringValue,
        recurring_duration: networkMonthly.recurringDuration
      });

      const { error: networkMonthlyError } = await supabase
        .from('network_commission')
        .insert({
          settings_id: newSettings.id,
          subscription_type: 'monthly',
          commission_model: networkMonthly.model,
          ...cleanedNetworkMonthly
        });

      if (networkMonthlyError) throw networkMonthlyError;

      // Save network commission - yearly (with cleanup)
      const cleanedNetworkYearly = cleanCommissionData(networkYearly.model, {
        onetime_type: networkYearly.onetimeType,
        onetime_value: networkYearly.onetimeValue,
        recurring_type: networkYearly.recurringType,
        recurring_value: networkYearly.recurringValue,
        recurring_duration: networkYearly.recurringDuration
      });

      const { error: networkYearlyError } = await supabase
        .from('network_commission')
        .insert({
          settings_id: newSettings.id,
          subscription_type: 'yearly',
          commission_model: networkYearly.model,
          ...cleanedNetworkYearly
        });

      if (networkYearlyError) throw networkYearlyError;

      // Save plan-specific commissions
      for (const [planId, commission] of Object.entries(planCommissions)) {
        // Save monthly plan commission (with cleanup)
        const cleanedPlanMonthly = cleanCommissionData(commission.monthly.model, {
          onetime_type: commission.monthly.onetimeType,
          onetime_value: commission.monthly.onetimeValue,
          recurring_type: commission.monthly.recurringType,
          recurring_value: commission.monthly.recurringValue,
          recurring_duration: commission.monthly.recurringDuration
        });

        const { error: planMonthlyError } = await supabase
          .from('plan_commission')
          .insert({
            settings_id: newSettings.id,
            plan_id: planId,
            subscription_type: 'monthly',
            enabled: commission.enabled,
            commission_model: commission.monthly.model,
            ...cleanedPlanMonthly
          });

        if (planMonthlyError) throw planMonthlyError;

        // Save yearly plan commission (with cleanup)
        const cleanedPlanYearly = cleanCommissionData(commission.yearly.model, {
          onetime_type: commission.yearly.onetimeType,
          onetime_value: commission.yearly.onetimeValue,
          recurring_type: commission.yearly.recurringType,
          recurring_value: commission.yearly.recurringValue,
          recurring_duration: commission.yearly.recurringDuration
        });

        const { error: planYearlyError } = await supabase
          .from('plan_commission')
          .insert({
            settings_id: newSettings.id,
            plan_id: planId,
            subscription_type: 'yearly',
            enabled: commission.enabled,
            commission_model: commission.yearly.model,
            ...cleanedPlanYearly
          });

        if (planYearlyError) throw planYearlyError;
      }

      // Generate and show change summary
      const changes = generateChangeSummary();
      setChangeSummary(changes);
      setShowChangeSummary(true);

      toast.success(`Settings saved successfully! (Version ${newVersion})`);
      setSaving(false);

      // Update original values to current values after successful save
      setOriginalValues({
        networkMonthly: { ...networkMonthly },
        networkYearly: { ...networkYearly },
        planCommissions: JSON.parse(JSON.stringify(planCommissions)),
        enableMultiTier,
        autoApproveApplications,
        sendWelcomeEmail,
        sendCommissionNotifications,
        minPayoutThreshold,
        paymentSchedule,
        paymentDay,
        maxHelpersPerRecruiter,
        referralCodePrefix,
        autoGenerateCodes
      });
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
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : Number(e.target.value);
                            setNetworkMonthly(prev => ({ ...prev, onetimeValue: value }));
                            validateField("networkMonthlyOnetimeValue", value, networkMonthly.onetimeType);
                          }}
                          onBlur={() => validateField("networkMonthlyOnetimeValue", networkMonthly.onetimeValue, networkMonthly.onetimeType)}
                          min={0}
                          max={networkMonthly.onetimeType === "percentage" ? 100 : undefined}
                          className={fieldErrors.networkMonthlyOnetimeValue ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {fieldErrors.networkMonthlyOnetimeValue && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                            <span className="text-sm">⚠️</span> {fieldErrors.networkMonthlyOnetimeValue}
                          </p>
                        )}
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
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : Number(e.target.value);
                            setNetworkMonthly(prev => ({ ...prev, recurringValue: value }));
                            validateField("networkMonthlyRecurringValue", value, networkMonthly.recurringType);
                          }}
                          onBlur={() => validateField("networkMonthlyRecurringValue", networkMonthly.recurringValue, networkMonthly.recurringType)}
                          min={0}
                          max={networkMonthly.recurringType === "percentage" ? 100 : undefined}
                          className={fieldErrors.networkMonthlyRecurringValue ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                        {fieldErrors.networkMonthlyRecurringValue && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                            <span className="text-sm">⚠️</span> {fieldErrors.networkMonthlyRecurringValue}
                          </p>
                        )}
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
                          onChange={(e) => setNetworkYearly(prev => ({ ...prev, onetimeValue: e.target.value === "" ? 0 : Number(e.target.value) }))}
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
                          onChange={(e) => setNetworkYearly(prev => ({ ...prev, recurringValue: e.target.value === "" ? 0 : Number(e.target.value) }))}
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
            {subscriptionPlans.length === 0 ? (
              <div className="bg-muted/50 border border-dashed rounded-lg p-8 text-center">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground font-medium">No subscription plans found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please create subscription plans first before configuring plan-specific commissions.
                </p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {subscriptionPlans.map((plan) => {
                const commission = planCommissions[plan.id];

                // Skip if commission not initialized yet
                if (!commission) return null;

                return (
                  <AccordionItem key={plan.id} value={plan.id}>
                    <div className="flex items-center justify-between w-full">
                      <AccordionTrigger className="flex-1 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold ${!commission.enabled ? "text-red-600 dark:text-red-400" : ""}`}>
                            {plan.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ₹{plan.monthly_price}/month • ₹{plan.yearly_price}/year
                          </span>
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-2 pr-4">
                        <Switch
                          checked={commission.enabled}
                          onCheckedChange={() => togglePlanCommission(plan.id)}
                        />
                        <span className={`text-sm ${!commission.enabled ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {commission.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
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
            )}
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
              <div className="relative">
                <Input
                  type="number"
                  value={minPayoutThreshold}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setMinPayoutThreshold(value);
                    validateField("minPayoutThreshold", value);
                  }}
                  onBlur={() => validateField("minPayoutThreshold", minPayoutThreshold)}
                  min={0}
                  className={fieldErrors.minPayoutThreshold ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {fieldErrors.minPayoutThreshold && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <span className="text-sm">⚠️</span> {fieldErrors.minPayoutThreshold}
                  </p>
                )}
              </div>
              {!fieldErrors.minPayoutThreshold && (
                <p className="text-xs text-muted-foreground">
                  Helpers must earn at least this amount before payment is processed
                </p>
              )}
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
              <div className="relative">
                <Input
                  value={referralCodePrefix}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setReferralCodePrefix(value);
                    validateField("referralCodePrefix", value);
                  }}
                  onBlur={() => validateField("referralCodePrefix", referralCodePrefix)}
                  placeholder="HELP"
                  maxLength={6}
                  className={fieldErrors.referralCodePrefix ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {fieldErrors.referralCodePrefix && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <span className="text-sm">⚠️</span> {fieldErrors.referralCodePrefix}
                  </p>
                )}
              </div>
              {!fieldErrors.referralCodePrefix && (
                <p className="text-xs text-muted-foreground">
                  Prefix for auto-generated referral codes (e.g., HELP001, HELP002)
                </p>
              )}
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
                  {auditRecords.map((record) => {
                    // Get plan name if this is a plan commission change
                    let planName = "";
                    let subscriptionType = "";
                    if (record.table_name === "plan_commission" && record.new_value?.plan_id) {
                      const plan = subscriptionPlans.find(p => p.id === record.new_value.plan_id);
                      planName = plan?.name || "Unknown Plan";
                      subscriptionType = record.new_value.subscription_type
                        ? ` - ${record.new_value.subscription_type.charAt(0).toUpperCase() + record.new_value.subscription_type.slice(1)}`
                        : "";
                    } else if (record.table_name === "network_commission" && record.new_value?.subscription_type) {
                      subscriptionType = ` - ${record.new_value.subscription_type.charAt(0).toUpperCase() + record.new_value.subscription_type.slice(1)}`;
                    }

                    return (
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
                              {planName && ` - "${planName}"${subscriptionType}`}
                              {!planName && subscriptionType}
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
                              <p className="text-xs text-muted-foreground font-semibold">Previous Values:</p>
                              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-3 text-xs space-y-1">
                                {Object.entries(record.old_value).map(([key, value]: [string, any]) => {
                                  // Skip internal fields
                                  if (['id', 'created_at', 'settings_id', 'plan_id'].includes(key)) return null;

                                  // Format field name
                                  const fieldName = key
                                    .split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');

                                  // Format value
                                  let displayValue = value;
                                  if (key === 'commission_model') {
                                    displayValue = value === 'onetime' ? 'One-time' : value === 'recurring' ? 'Recurring' : 'Hybrid';
                                  } else if (key === 'subscription_type') {
                                    displayValue = value.charAt(0).toUpperCase() + value.slice(1);
                                  } else if (key.includes('_type') && (value === 'percentage' || value === 'fixed')) {
                                    displayValue = value === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (₹)';
                                  } else if (key.includes('_value') && key.includes('onetime')) {
                                    const typeKey = key.replace('value', 'type');
                                    const type = record.old_value[typeKey];
                                    displayValue = type === 'percentage' ? `${value}%` : `₹${value}`;
                                  } else if (key.includes('_value') && key.includes('recurring')) {
                                    const typeKey = key.replace('value', 'type');
                                    const type = record.old_value[typeKey];
                                    displayValue = type === 'percentage' ? `${value}%` : `₹${value}`;
                                  } else if (key.includes('duration')) {
                                    displayValue = `${value} months`;
                                  } else if (typeof value === 'boolean') {
                                    displayValue = value ? 'Enabled' : 'Disabled';
                                  }

                                  return (
                                    <div key={key} className="flex justify-between py-1 border-b border-red-200 dark:border-red-700 last:border-0">
                                      <span className="text-muted-foreground">{fieldName}:</span>
                                      <span className="font-medium">{String(displayValue)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {record.new_value && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-semibold">New Values:</p>
                              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-3 text-xs space-y-1">
                                {Object.entries(record.new_value).map(([key, value]: [string, any]) => {
                                  // Skip internal fields
                                  if (['id', 'created_at', 'settings_id', 'plan_id'].includes(key)) return null;

                                  // Format field name
                                  const fieldName = key
                                    .split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');

                                  // Format value
                                  let displayValue = value;
                                  if (key === 'commission_model') {
                                    displayValue = value === 'onetime' ? 'One-time' : value === 'recurring' ? 'Recurring' : 'Hybrid';
                                  } else if (key === 'subscription_type') {
                                    displayValue = value.charAt(0).toUpperCase() + value.slice(1);
                                  } else if (key.includes('_type') && (value === 'percentage' || value === 'fixed')) {
                                    displayValue = value === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (₹)';
                                  } else if (key.includes('_value') && key.includes('onetime')) {
                                    const typeKey = key.replace('value', 'type');
                                    const type = record.new_value[typeKey];
                                    displayValue = type === 'percentage' ? `${value}%` : `₹${value}`;
                                  } else if (key.includes('_value') && key.includes('recurring')) {
                                    const typeKey = key.replace('value', 'type');
                                    const type = record.new_value[typeKey];
                                    displayValue = type === 'percentage' ? `${value}%` : `₹${value}`;
                                  } else if (key.includes('duration')) {
                                    displayValue = `${value} months`;
                                  } else if (typeof value === 'boolean') {
                                    displayValue = value ? 'Enabled' : 'Disabled';
                                  }

                                  return (
                                    <div key={key} className="flex justify-between py-1 border-b border-green-200 dark:border-green-700 last:border-0">
                                      <span className="text-muted-foreground">{fieldName}:</span>
                                      <span className="font-medium">{String(displayValue)}</span>
                                    </div>
                                  );
                                })}
                              </div>
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
                  );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Save Button */}
        <div className="flex flex-col items-end gap-2">
          {Object.keys(fieldErrors).length > 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <span>⚠️</span> Fix {Object.keys(fieldErrors).length} error{Object.keys(fieldErrors).length > 1 ? 's' : ''} before saving
            </p>
          )}
          <Button
            size="lg"
            onClick={handleSaveSettings}
            disabled={saving || Object.keys(fieldErrors).length > 0}
            className={Object.keys(fieldErrors).length > 0 ? "opacity-50 cursor-not-allowed" : ""}
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? "Saving..." : "Save All Settings"}
          </Button>
        </div>

        {/* Change Summary Modal */}
        <Dialog open={showChangeSummary} onOpenChange={setShowChangeSummary}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Settings Saved Successfully
              </DialogTitle>
              <DialogDescription className="text-base">
                {(changeSummary.commissionModel.length +
                  changeSummary.commissionRates.length +
                  changeSummary.featureToggles.length +
                  changeSummary.paymentSettings.length +
                  changeSummary.recruitmentSettings.length)} changes applied to your commission settings
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              {(changeSummary.commissionModel.length +
                changeSummary.commissionRates.length +
                changeSummary.featureToggles.length +
                changeSummary.paymentSettings.length +
                changeSummary.recruitmentSettings.length) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No changes detected</p>
                </div>
              ) : (
                <>
                  {/* Network Commission Settings Display */}
                  {(originalValues && (
                    JSON.stringify(networkMonthly) !== JSON.stringify(originalValues.networkMonthly) ||
                    JSON.stringify(networkYearly) !== JSON.stringify(originalValues.networkYearly)
                  )) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                        <h3 className="font-semibold text-base">Network Commission Settings</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Monthly Column */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                              Monthly Subscription
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                <span className="font-medium">
                                  {networkMonthly.model === "onetime" ? "One-time" :
                                   networkMonthly.model === "recurring" ? "Recurring" : "Hybrid"}
                                </span>
                              </div>

                              {(networkMonthly.model === "onetime" || networkMonthly.model === "hybrid") && (
                                <>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                    <span className="font-medium">
                                      {networkMonthly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      {networkMonthly.onetimeType === "percentage"
                                        ? `${networkMonthly.onetimeValue}%`
                                        : `₹${networkMonthly.onetimeValue}`}
                                    </span>
                                  </div>
                                </>
                              )}

                              {(networkMonthly.model === "recurring" || networkMonthly.model === "hybrid") && (
                                <>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                    <span className="font-medium">
                                      {networkMonthly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      {networkMonthly.recurringType === "percentage"
                                        ? `${networkMonthly.recurringValue}%`
                                        : `₹${networkMonthly.recurringValue}`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                    <span className="font-medium">{networkMonthly.recurringDuration} months</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Yearly Column */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-sm text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                              Yearly Subscription
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between py-2 border-b">
                                <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                <span className="font-medium">
                                  {networkYearly.model === "onetime" ? "One-time" :
                                   networkYearly.model === "recurring" ? "Recurring" : "Hybrid"}
                                </span>
                              </div>

                              {(networkYearly.model === "onetime" || networkYearly.model === "hybrid") && (
                                <>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                    <span className="font-medium">
                                      {networkYearly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      {networkYearly.onetimeType === "percentage"
                                        ? `${networkYearly.onetimeValue}%`
                                        : `₹${networkYearly.onetimeValue}`}
                                    </span>
                                  </div>
                                </>
                              )}

                              {(networkYearly.model === "recurring" || networkYearly.model === "hybrid") && (
                                <>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                    <span className="font-medium">
                                      {networkYearly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      {networkYearly.recurringType === "percentage"
                                        ? `${networkYearly.recurringValue}%`
                                        : `₹${networkYearly.recurringValue}`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                    <span className="font-medium">{networkYearly.recurringDuration} months</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plan-Specific Commission Settings Display */}
                  {(originalValues && originalValues.planCommissions && Object.keys(planCommissions).some(planId => {
                    const original = originalValues.planCommissions[planId];
                    return original && (
                      JSON.stringify(planCommissions[planId]) !== JSON.stringify(original)
                    );
                  })) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                        <h3 className="font-semibold text-base">Plan-Specific Commission Settings</h3>
                      </div>
                      <div className="p-4 space-y-6">
                        {Object.keys(planCommissions).map(planId => {
                          const plan = subscriptionPlans.find(p => p.id === planId);
                          const current = planCommissions[planId];
                          const original = originalValues?.planCommissions?.[planId];

                          // Only show if there are changes
                          if (!plan || !original || JSON.stringify(current) === JSON.stringify(original)) {
                            return null;
                          }

                          return (
                            <div key={planId} className="border-l-4 border-purple-500 pl-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-base">{plan.name}</h4>
                                <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                                  current.enabled
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {current.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                              </div>

                              {current.enabled && (
                                <div className="grid grid-cols-2 gap-6">
                                  {/* Monthly Column */}
                                  <div className="space-y-4">
                                    <h5 className="font-semibold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                      Monthly Subscription
                                    </h5>
                                    <div className="space-y-3 text-sm">
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                        <span className="font-medium">
                                          {current.monthly.model === "onetime" ? "One-time" :
                                           current.monthly.model === "recurring" ? "Recurring" : "Hybrid"}
                                        </span>
                                      </div>

                                      {(current.monthly.model === "onetime" || current.monthly.model === "hybrid") && (
                                        <>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                            <span className="font-medium">
                                              {current.monthly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                              {current.monthly.onetimeType === "percentage"
                                                ? `${current.monthly.onetimeValue}%`
                                                : `₹${current.monthly.onetimeValue}`}
                                            </span>
                                          </div>
                                        </>
                                      )}

                                      {(current.monthly.model === "recurring" || current.monthly.model === "hybrid") && (
                                        <>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                            <span className="font-medium">
                                              {current.monthly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                              {current.monthly.recurringType === "percentage"
                                                ? `${current.monthly.recurringValue}%`
                                                : `₹${current.monthly.recurringValue}`}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                            <span className="font-medium">{current.monthly.recurringDuration} months</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Yearly Column */}
                                  <div className="space-y-4">
                                    <h5 className="font-semibold text-sm text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                                      Yearly Subscription
                                    </h5>
                                    <div className="space-y-3 text-sm">
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                        <span className="font-medium">
                                          {current.yearly.model === "onetime" ? "One-time" :
                                           current.yearly.model === "recurring" ? "Recurring" : "Hybrid"}
                                        </span>
                                      </div>

                                      {(current.yearly.model === "onetime" || current.yearly.model === "hybrid") && (
                                        <>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                            <span className="font-medium">
                                              {current.yearly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                              {current.yearly.onetimeType === "percentage"
                                                ? `${current.yearly.onetimeValue}%`
                                                : `₹${current.yearly.onetimeValue}`}
                                            </span>
                                          </div>
                                        </>
                                      )}

                                      {(current.yearly.model === "recurring" || current.yearly.model === "hybrid") && (
                                        <>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                            <span className="font-medium">
                                              {current.yearly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                              {current.yearly.recurringType === "percentage"
                                                ? `${current.yearly.recurringValue}%`
                                                : `₹${current.yearly.recurringValue}`}
                                            </span>
                                          </div>
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                            <span className="font-medium">{current.yearly.recurringDuration} months</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fallback: Show changes in structured format if main sections don't render */}
                  {(changeSummary.commissionModel.length > 0 || changeSummary.commissionRates.length > 0) &&
                   (!originalValues ||
                    (JSON.stringify(networkMonthly) === JSON.stringify(originalValues.networkMonthly) &&
                     JSON.stringify(networkYearly) === JSON.stringify(originalValues.networkYearly) &&
                     !Object.keys(planCommissions).some(planId => {
                       const original = originalValues.planCommissions?.[planId];
                       return original && JSON.stringify(planCommissions[planId]) !== JSON.stringify(original);
                     }))) && (
                    <>
                      {/* Check if changes are for Network Commission */}
                      {(changeSummary.commissionModel.some(c => c.startsWith('Monthly:') || c.startsWith('Yearly:')) ||
                        changeSummary.commissionRates.some(c => c.startsWith('Monthly') || c.startsWith('Yearly'))) && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                            <h3 className="font-semibold text-base">Network Commission Settings</h3>
                          </div>
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Monthly Column */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                  Monthly Subscription
                                </h4>
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                    <span className="font-medium">
                                      {networkMonthly.model === "onetime" ? "One-time" :
                                       networkMonthly.model === "recurring" ? "Recurring" : "Hybrid"}
                                    </span>
                                  </div>
                                  {(networkMonthly.model === "onetime" || networkMonthly.model === "hybrid") && (
                                    <>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                        <span className="font-medium">
                                          {networkMonthly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                          {networkMonthly.onetimeType === "percentage"
                                            ? `${networkMonthly.onetimeValue}%`
                                            : `₹${networkMonthly.onetimeValue}`}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                  {(networkMonthly.model === "recurring" || networkMonthly.model === "hybrid") && (
                                    <>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                        <span className="font-medium">
                                          {networkMonthly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                          {networkMonthly.recurringType === "percentage"
                                            ? `${networkMonthly.recurringValue}%`
                                            : `₹${networkMonthly.recurringValue}`}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                        <span className="font-medium">{networkMonthly.recurringDuration} months</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Yearly Column */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-sm text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                                  Yearly Subscription
                                </h4>
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between py-2 border-b">
                                    <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                    <span className="font-medium">
                                      {networkYearly.model === "onetime" ? "One-time" :
                                       networkYearly.model === "recurring" ? "Recurring" : "Hybrid"}
                                    </span>
                                  </div>
                                  {(networkYearly.model === "onetime" || networkYearly.model === "hybrid") && (
                                    <>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                        <span className="font-medium">
                                          {networkYearly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                          {networkYearly.onetimeType === "percentage"
                                            ? `${networkYearly.onetimeValue}%`
                                            : `₹${networkYearly.onetimeValue}`}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                  {(networkYearly.model === "recurring" || networkYearly.model === "hybrid") && (
                                    <>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                        <span className="font-medium">
                                          {networkYearly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                          {networkYearly.recurringType === "percentage"
                                            ? `${networkYearly.recurringValue}%`
                                            : `₹${networkYearly.recurringValue}`}
                                        </span>
                                      </div>
                                      <div className="flex justify-between py-2 border-b">
                                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                        <span className="font-medium">{networkYearly.recurringDuration} months</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Check if changes are for Plan-Specific Commission */}
                      {Object.keys(planCommissions).filter(planId => {
                        const plan = subscriptionPlans.find(p => p.id === planId);
                        return plan && (
                          changeSummary.commissionModel.some(c => c.includes(plan.name)) ||
                          changeSummary.commissionRates.some(c => c.includes(plan.name)) ||
                          changeSummary.featureToggles.some(c => c.includes(plan.name))
                        );
                      }).length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                            <h3 className="font-semibold text-base">Plan-Specific Commission Settings</h3>
                          </div>
                          <div className="p-4 space-y-6">
                            {Object.keys(planCommissions).map(planId => {
                              const plan = subscriptionPlans.find(p => p.id === planId);
                              const current = planCommissions[planId];

                              // Only show plans that have changes
                              if (!plan || !(
                                changeSummary.commissionModel.some(c => c.includes(plan.name)) ||
                                changeSummary.commissionRates.some(c => c.includes(plan.name)) ||
                                changeSummary.featureToggles.some(c => c.includes(plan.name))
                              )) {
                                return null;
                              }

                              return (
                                <div key={planId} className="border-l-4 border-purple-500 pl-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-base">{plan.name}</h4>
                                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                                      current.enabled
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                      {current.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </div>

                                  {current.enabled && (
                                    <div className="grid grid-cols-2 gap-6">
                                      {/* Monthly Column */}
                                      <div className="space-y-4">
                                        <h5 className="font-semibold text-sm text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                          Monthly Subscription
                                        </h5>
                                        <div className="space-y-3 text-sm">
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                            <span className="font-medium">
                                              {current.monthly.model === "onetime" ? "One-time" :
                                               current.monthly.model === "recurring" ? "Recurring" : "Hybrid"}
                                            </span>
                                          </div>
                                          {(current.monthly.model === "onetime" || current.monthly.model === "hybrid") && (
                                            <>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                                <span className="font-medium">
                                                  {current.monthly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                                </span>
                                              </div>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                  {current.monthly.onetimeType === "percentage"
                                                    ? `${current.monthly.onetimeValue}%`
                                                    : `₹${current.monthly.onetimeValue}`}
                                                </span>
                                              </div>
                                            </>
                                          )}
                                          {(current.monthly.model === "recurring" || current.monthly.model === "hybrid") && (
                                            <>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                                <span className="font-medium">
                                                  {current.monthly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                                </span>
                                              </div>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                  {current.monthly.recurringType === "percentage"
                                                    ? `${current.monthly.recurringValue}%`
                                                    : `₹${current.monthly.recurringValue}`}
                                                </span>
                                              </div>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                                <span className="font-medium">{current.monthly.recurringDuration} months</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {/* Yearly Column */}
                                      <div className="space-y-4">
                                        <h5 className="font-semibold text-sm text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                                          Yearly Subscription
                                        </h5>
                                        <div className="space-y-3 text-sm">
                                          <div className="flex justify-between py-2 border-b">
                                            <span className="text-gray-600 dark:text-gray-400">Commission Model:</span>
                                            <span className="font-medium">
                                              {current.yearly.model === "onetime" ? "One-time" :
                                               current.yearly.model === "recurring" ? "Recurring" : "Hybrid"}
                                            </span>
                                          </div>
                                          {(current.yearly.model === "onetime" || current.yearly.model === "hybrid") && (
                                            <>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">One-time Type:</span>
                                                <span className="font-medium">
                                                  {current.yearly.onetimeType === "percentage" ? "Percentage" : "Fixed Amount"}
                                                </span>
                                              </div>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">One-time Rate:</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                  {current.yearly.onetimeType === "percentage"
                                                    ? `${current.yearly.onetimeValue}%`
                                                    : `₹${current.yearly.onetimeValue}`}
                                                </span>
                                              </div>
                                            </>
                                          )}
                                          {(current.yearly.model === "recurring" || current.yearly.model === "hybrid") && (
                                            <>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">Recurring Type:</span>
                                                <span className="font-medium">
                                                  {current.yearly.recurringType === "percentage" ? "Percentage" : "Fixed Amount"}
                                                </span>
                                              </div>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">Recurring Rate:</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                  {current.yearly.recurringType === "percentage"
                                                    ? `${current.yearly.recurringValue}%`
                                                    : `₹${current.yearly.recurringValue}`}
                                                </span>
                                              </div>
                                              <div className="flex justify-between py-2 border-b">
                                                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                                <span className="font-medium">{current.yearly.recurringDuration} months</span>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Other Settings Changes */}
                  {(changeSummary.featureToggles.length > 0 ||
                    changeSummary.paymentSettings.length > 0 ||
                    changeSummary.recruitmentSettings.length > 0) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b">
                        <h3 className="font-semibold text-base">Other Settings Updated</h3>
                      </div>
                      <div className="p-4 space-y-4">
                        {changeSummary.featureToggles.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Feature Settings</h4>
                            <ul className="space-y-1 text-sm">
                              {changeSummary.featureToggles.map((change, index) => (
                                <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  {change}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {changeSummary.paymentSettings.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Payment Settings</h4>
                            <ul className="space-y-1 text-sm">
                              {changeSummary.paymentSettings.map((change, index) => (
                                <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  {change}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {changeSummary.recruitmentSettings.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Recruitment Settings</h4>
                            <ul className="space-y-1 text-sm">
                              {changeSummary.recruitmentSettings.map((change, index) => (
                                <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  {change}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t pt-4">
              <Button onClick={() => setShowChangeSummary(false)} size="lg">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
