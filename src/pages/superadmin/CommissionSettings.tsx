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
import { Settings, Save, Plus, Info } from "lucide-react";

interface PlanRate {
  plan_name: string;
  commission_rate: number;
}

export default function SuperAdminCommissionSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global Commission Rates
  const [defaultDirectRate, setDefaultDirectRate] = useState(10);
  const [defaultNetworkRate, setDefaultNetworkRate] = useState(5);
  const [planRates, setPlanRates] = useState<PlanRate[]>([
    { plan_name: "Basic Plan", commission_rate: 10 },
    { plan_name: "Premium Plan", commission_rate: 10 },
    { plan_name: "Enterprise Plan", commission_rate: 10 }
  ]);

  // Feature Toggles
  const [enableMultiTier, setEnableMultiTier] = useState(true);
  const [autoApproveApplications, setAutoApproveApplications] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [sendCommissionNotifications, setSendCommissionNotifications] = useState(true);

  // Payment Settings
  const [minPayoutThreshold, setMinPayoutThreshold] = useState(500);
  const [paymentSchedule, setPaymentSchedule] = useState("monthly");
  const [paymentDay, setPaymentDay] = useState("1st");

  // Trial Period Settings
  const [defaultTrialDays, setDefaultTrialDays] = useState(7);
  const [sendTrialReminders, setSendTrialReminders] = useState(true);
  const [reminderBeforeDays, setReminderBeforeDays] = useState(2);

  // Helper Recruitment Settings
  const [maxHelpersPerRecruiter, setMaxHelpersPerRecruiter] = useState(-1); // -1 = unlimited
  const [referralCodePrefix, setReferralCodePrefix] = useState("HELP");
  const [autoGenerateCodes, setAutoGenerateCodes] = useState(true);

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

  const loadSettings = async () => {
    // In a real implementation, load from database
    // For now, using default values
    toast.success("Settings loaded");
  };

  const handleAddPlanRate = () => {
    setPlanRates([...planRates, { plan_name: "New Plan", commission_rate: 10 }]);
  };

  const handleUpdatePlanRate = (index: number, field: "plan_name" | "commission_rate", value: string | number) => {
    const updated = [...planRates];
    updated[index] = { ...updated[index], [field]: value };
    setPlanRates(updated);
  };

  const handleDeletePlanRate = (index: number) => {
    const updated = planRates.filter((_, i) => i !== index);
    setPlanRates(updated);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // In a real implementation, save to database
      // For now, just show success message

      const settings = {
        global_rates: {
          default_direct_rate: defaultDirectRate,
          default_network_rate: defaultNetworkRate,
          plan_specific_rates: planRates
        },
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
        trial: {
          default_trial_days: defaultTrialDays,
          send_trial_reminders: sendTrialReminders,
          reminder_before_days: reminderBeforeDays
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

  // Example calculator values
  const exampleHelperEarning = 100;
  const exampleRecruiterEarning = (exampleHelperEarning * defaultNetworkRate) / 100;

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

        {/* Global Commission Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Global Commission Rates</CardTitle>
            <CardDescription>Set default commission rates for all helpers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Default Direct Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={defaultDirectRate}
                  onChange={(e) => setDefaultDirectRate(parseFloat(e.target.value))}
                  min={0}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  Commission earned when helper refers a store owner
                </p>
              </div>

              <div className="space-y-2">
                <Label>Default Network Commission Rate (%)</Label>
                <Input
                  type="number"
                  value={defaultNetworkRate}
                  onChange={(e) => setDefaultNetworkRate(parseFloat(e.target.value))}
                  min={0}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of recruited helper's earning
                </p>
              </div>
            </div>

            {/* Example Calculator */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Network Commission Example:
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    If a recruited helper earns ₹{exampleHelperEarning}, the recruiter gets{" "}
                    <span className="font-bold">₹{exampleRecruiterEarning.toFixed(2)}</span>{" "}
                    ({defaultNetworkRate}% of ₹{exampleHelperEarning})
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan-Specific Rates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Plan-Specific Commission Rates</CardTitle>
                <CardDescription>Set different rates for each subscription plan</CardDescription>
              </div>
              <Button size="sm" onClick={handleAddPlanRate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Plan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan Name</TableHead>
                  <TableHead>Commission Rate (%)</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planRates.map((plan, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Input
                        value={plan.plan_name}
                        onChange={(e) => handleUpdatePlanRate(index, "plan_name", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={plan.commission_rate}
                        onChange={(e) => handleUpdatePlanRate(index, "commission_rate", parseFloat(e.target.value))}
                        min={0}
                        max={100}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeletePlanRate(index)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

        {/* Trial Period Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Trial Period Settings</CardTitle>
            <CardDescription>Configure trial period for store owners</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Trial Days</Label>
              <Input
                type="number"
                value={defaultTrialDays}
                onChange={(e) => setDefaultTrialDays(parseInt(e.target.value))}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Number of free trial days for new store owners
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send Trial Expiry Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Notify store owners before their trial expires
                </p>
              </div>
              <Switch checked={sendTrialReminders} onCheckedChange={setSendTrialReminders} />
            </div>

            {sendTrialReminders && (
              <div className="space-y-2">
                <Label>Send Reminder Before (Days)</Label>
                <Input
                  type="number"
                  value={reminderBeforeDays}
                  onChange={(e) => setReminderBeforeDays(parseInt(e.target.value))}
                  min={1}
                />
                <p className="text-xs text-muted-foreground">
                  Send reminder this many days before trial expires
                </p>
              </div>
            )}
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
