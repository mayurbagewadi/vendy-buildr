import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import {
  UserCircle,
  LogOut,
  Settings,
  ArrowLeft,
  Edit,
  Save,
  X,
  Lock,
  CreditCard,
  TrendingUp,
  Award,
  Calendar,
  Mail,
  Phone,
  Shield,
  Building,
  CheckCircle2
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

export default function HelperProfile() {
  const navigate = useNavigate();
  const { toast: toastHook } = useToast();
  const [loading, setLoading] = useState(true);
  const [helper, setHelper] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingBankUpdate, setPendingBankUpdate] = useState<any>(null);

  // Profile edit form
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: ""
  });

  // Bank details form
  const [bankForm, setBankForm] = useState({
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    bank_name: ""
  });

  // Password verification
  const [verifyPassword, setVerifyPassword] = useState("");

  // Change password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Performance stats
  const [performance, setPerformance] = useState({
    memberSince: "",
    daysActive: 0,
    totalEarnings: 0,
    rank: "Bronze",
    badges: [] as string[]
  });

  useEffect(() => {
    checkHelperAccess();
  }, []);

  const checkHelperAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: helperData, error: helperError } = await supabase
        .from("helpers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (helperError || !helperData) {
        navigate("/helper/dashboard");
        return;
      }

      setHelper(helperData);
      setProfileForm({
        full_name: helperData.full_name,
        phone: helperData.phone
      });
      
      // Fetch bank details from helper_applications table
      if (helperData.application_id) {
        const { data: applicationData } = await supabase
          .from("helper_applications")
          .select("bank_account_name, bank_account_number, bank_ifsc_code, bank_name")
          .eq("id", helperData.application_id)
          .single();
        
        if (applicationData) {
          setBankForm({
            account_holder_name: applicationData.bank_account_name || "",
            account_number: applicationData.bank_account_number || "",
            ifsc_code: applicationData.bank_ifsc_code || "",
            bank_name: applicationData.bank_name || ""
          });
        }
      }

      await loadPerformance(helperData.id, helperData.created_at);
      setLoading(false);
    } catch (error) {
      console.error("Error checking helper access:", error);
      navigate("/auth");
    }
  };

  const loadPerformance = async (helperId: string, createdAt: string) => {
    try {
      // Calculate days active
      const daysActive = differenceInDays(new Date(), new Date(createdAt));

      // Get total earnings from commissions
      const { data: commissions } = await supabase
        .from("network_commissions")
        .select("direct_commission_amount, network_commission_amount")
        .eq("earning_helper_id", helperId);

      const totalEarnings = commissions?.reduce(
        (sum, c) => sum + (c.direct_commission_amount || 0) + (c.network_commission_amount || 0),
        0
      ) || 0;

      // Calculate rank based on total earnings
      let rank = "Bronze";
      const badges: string[] = [];

      if (totalEarnings >= 100000) {
        rank = "Gold";
        badges.push("Gold Member", "Top Performer", "Network Builder");
      } else if (totalEarnings >= 50000) {
        rank = "Silver";
        badges.push("Silver Member", "Rising Star");
      } else {
        rank = "Bronze";
        if (daysActive >= 30) badges.push("Consistent Helper");
        if (totalEarnings > 0) badges.push("First Earnings");
      }

      setPerformance({
        memberSince: format(new Date(createdAt), "PPP"),
        daysActive,
        totalEarnings,
        rank,
        badges
      });
    } catch (error) {
      console.error("Error loading performance:", error);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase
        .from("helpers")
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          updated_at: new Date().toISOString()
        })
        .eq("id", helper.id);

      if (error) throw error;

      setHelper({ ...helper, full_name: profileForm.full_name, phone: profileForm.phone });
      setEditingProfile(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleBankDetailsSubmit = () => {
    setPendingBankUpdate(bankForm);
    setShowPasswordDialog(true);
  };

  const handleVerifyPasswordAndUpdateBank = async () => {
    try {
      // Verify password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("User not found");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: verifyPassword
      });

      if (signInError) {
        toast.error("Incorrect password");
        return;
      }

      // Update bank details in helper_applications table
      const { error: updateError } = await supabase
        .from("helper_applications")
        .update({
          bank_account_name: pendingBankUpdate.account_holder_name,
          bank_account_number: pendingBankUpdate.account_number,
          bank_ifsc_code: pendingBankUpdate.ifsc_code,
          bank_name: pendingBankUpdate.bank_name
        })
        .eq("id", helper.application_id);

      if (updateError) throw updateError;

      setHelper({
        ...helper,
        bank_account_holder_name: pendingBankUpdate.account_holder_name,
        bank_account_number: pendingBankUpdate.account_number,
        bank_ifsc_code: pendingBankUpdate.ifsc_code,
        bank_name: pendingBankUpdate.bank_name
      });

      setEditingBank(false);
      setShowPasswordDialog(false);
      setVerifyPassword("");
      setPendingBankUpdate(null);
      toast.success("Bank details updated successfully!");
    } catch (error) {
      console.error("Error updating bank details:", error);
      toast.error("Failed to update bank details");
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      // Verify current password
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("User not found");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword
      });

      if (signInError) {
        toast.error("Current password is incorrect");
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) throw updateError;

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      toast.success("Password changed successfully!");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password");
    }
  };

  const getRankBadge = (rank: string) => {
    const colors: { [key: string]: string } = {
      Bronze: "bg-orange-500",
      Silver: "bg-gray-400",
      Gold: "bg-yellow-500"
    };
    return (
      <Badge className={`${colors[rank]} text-white text-lg px-4 py-1`}>
        <Award className="w-4 h-4 mr-2" />
        {rank}
      </Badge>
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toastHook({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/helper/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Profile & Settings</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  <span>{helper?.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  {!editingProfile ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingProfile(false);
                        setProfileForm({
                          full_name: helper.full_name,
                          phone: helper.phone
                        });
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleUpdateProfile}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingProfile ? (
                  <>
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email (Cannot be changed)</Label>
                      <Input value={helper.email} disabled />
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Full Name</p>
                      <p className="font-semibold">{helper.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Email</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {helper.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Phone</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {helper.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Helper ID</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {helper.helper_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Referral Code</p>
                      <p className="font-semibold text-primary">{helper.referral_code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Joined Date</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(helper.created_at), "PPP")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Status</p>
                      <Badge className={helper.status === "Active" ? "bg-green-500" : "bg-red-500"}>
                        {helper.status}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Bank Details
                  </CardTitle>
                  {!editingBank ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingBank(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingBank(false);
                        setBankForm({
                          account_holder_name: helper.bank_account_holder_name || "",
                          account_number: helper.bank_account_number || "",
                          ifsc_code: helper.bank_ifsc_code || "",
                          bank_name: helper.bank_name || ""
                        });
                      }}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleBankDetailsSubmit}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingBank ? (
                  <>
                    <div className="space-y-2">
                      <Label>Account Holder Name</Label>
                      <Input
                        value={bankForm.account_holder_name}
                        onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input
                        value={bankForm.account_number}
                        onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IFSC Code</Label>
                      <Input
                        value={bankForm.ifsc_code}
                        onChange={(e) => setBankForm({ ...bankForm, ifsc_code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input
                        value={bankForm.bank_name}
                        onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {helper.bank_account_holder_name ? (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Account Holder Name</p>
                          <p className="font-semibold">{helper.bank_account_holder_name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Account Number</p>
                          <p className="font-semibold">
                            {helper.bank_account_number ? `****${helper.bank_account_number.slice(-4)}` : "Not provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">IFSC Code</p>
                          <p className="font-semibold">{helper.bank_ifsc_code || "Not provided"}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Bank Name</p>
                          <p className="font-semibold flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {helper.bank_name || "Not provided"}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 text-center py-8 text-muted-foreground">
                        <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No bank details added yet</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </div>
                <Button onClick={handleChangePassword}>Update Password</Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Performance */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Your Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  {getRankBadge(performance.rank)}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Member Since</span>
                    <span className="font-semibold">{performance.memberSince}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Days Active</span>
                    <span className="font-semibold text-blue-500">{performance.daysActive} days</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Total Earnings</span>
                    <span className="font-bold text-green-500 text-lg">
                      ₹{performance.totalEarnings.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Current Rank</span>
                    <span className="font-semibold">{performance.rank}</span>
                  </div>
                </div>

                {/* Achievement Badges */}
                {performance.badges.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Achievement Badges
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {performance.badges.map((badge, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rank Progress */}
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-sm font-semibold mb-3">Rank Progression</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Bronze</span>
                      <span className="text-muted-foreground">₹0+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Silver</span>
                      <span className="text-muted-foreground">₹50,000+</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Gold</span>
                      <span className="text-muted-foreground">₹100,000+</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Password Verification Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Password</DialogTitle>
            <DialogDescription>
              Please enter your password to confirm bank details update
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={verifyPassword}
                onChange={(e) => setVerifyPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPasswordDialog(false);
              setVerifyPassword("");
              setPendingBankUpdate(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleVerifyPasswordAndUpdateBank}>Verify & Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
