import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Users, DollarSign, MapPin, Loader2 } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";

const formSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  why_helper: z.string().optional(),
  bank_account_name: z.string().min(2, "Account holder name is required"),
  bank_account_number: z.string().min(8, "Invalid account number"),
  bank_ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  bank_name: z.string().min(2, "Bank name is required"),
  terms: z.boolean().refine((val) => val === true, "You must agree to terms and conditions"),
});

type FormValues = z.infer<typeof formSchema>;

export default function BecomeHelper() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [googleUserId, setGoogleUserId] = useState<string | null>(null);
  const referralCode = searchParams.get("ref");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      why_helper: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_ifsc_code: "",
      bank_name: "",
      terms: false,
    },
  });

  // Check if user came from Google OAuth and auto-fill form
  useEffect(() => {
    const checkGoogleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const user = session.user;

        // Check if user signed up with Google (provider is google)
        if (user.app_metadata?.provider === 'google') {
          setIsGoogleUser(true);
          setGoogleUserId(user.id);

          // Auto-fill email and name from Google profile
          form.setValue('email', user.email || '');
          form.setValue('full_name', user.user_metadata?.full_name || user.user_metadata?.name || '');

          toast.info('Signed in with Google! Please complete the remaining fields.');
        }
      }
    };

    checkGoogleSession();
  }, []);

  // Load recruiter name if referral code exists
  useEffect(() => {
    if (referralCode) {
      supabase
        .from("helpers")
        .select("full_name")
        .eq("referral_code", referralCode)
        .single()
        .then(({ data }) => {
          if (data) setRecruiterName(data.full_name);
        });
    }
  }, [referralCode]);

  const handleGoogleSignUp = async () => {
    try {
      setIsGoogleLoading(true);
      console.log('[BecomeHelper] Starting Google sign up...');

      // Preserve referral code in redirect URL
      const redirectUrl = referralCode
        ? `${window.location.origin}/become-helper?ref=${referralCode}`
        : `${window.location.origin}/become-helper`;

      // Google OAuth WITHOUT Drive scope (helpers don't need Drive access)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          // No scopes = only basic profile (email, name) - no Drive access
        },
      });

      if (error) {
        console.error('[BecomeHelper] Google sign up error:', error);
        toast.error(error.message || "Failed to sign up with Google");
      } else {
        console.log('[BecomeHelper] Google OAuth redirect initiated');
      }
    } catch (error: any) {
      console.error('[BecomeHelper] Unexpected error:', error);
      toast.error(error.message || "An unexpected error occurred");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      // CRITICAL: Check if email exists in stores table (store owners cannot be helpers)
      const { data: storeWithEmail } = await supabase
        .from("stores")
        .select("id, name, user_id")
        .eq("user_id", await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", values.email)
          .maybeSingle()
          .then(({ data }) => data?.user_id)
        )
        .maybeSingle();

      if (storeWithEmail) {
        toast.error(`❌ BLOCKED: This email (${values.email}) is already registered as a store owner (${storeWithEmail.name}). Store owners cannot become helpers. Please use a different email.`);
        return;
      }

      // Alternative check: Direct store lookup by matching user_id from email
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", values.email)
        .maybeSingle();

      if (profileData) {
        const { data: existingStore } = await supabase
          .from("stores")
          .select("id, name")
          .eq("user_id", profileData.user_id)
          .maybeSingle();

        if (existingStore) {
          toast.error(`❌ BLOCKED: This email is registered as store owner of "${existingStore.name}". Store owners cannot become helpers. Use a different email.`);
          return;
        }
      }

      // Check if phone number belongs to an existing store owner
      const { data: storeWithPhone } = await supabase
        .from("stores")
        .select("id, name, whatsapp_number")
        .eq("whatsapp_number", values.phone)
        .maybeSingle();

      if (storeWithPhone) {
        toast.error(`❌ BLOCKED: This phone number is already registered for store "${storeWithPhone.name}". Store owners cannot become helpers. Use a different phone number.`);
        return;
      }

      // Check if email exists in helper applications
      const { data: emailExists } = await supabase
        .from("helper_applications")
        .select("email")
        .eq("email", values.email)
        .maybeSingle();

      if (emailExists) {
        toast.error("This email is already registered as a helper");
        return;
      }

      // Check if phone exists in helper applications
      const { data: phoneExists } = await supabase
        .from("helper_applications")
        .select("phone")
        .eq("phone", values.phone)
        .maybeSingle();

      if (phoneExists) {
        toast.error("This phone number is already registered as a helper");
        return;
      }

      // User must be authenticated with Google to submit application
      if (!isGoogleUser || !googleUserId) {
        toast.error("Please sign in with Google first to submit your application");
        return;
      }

      const userId = googleUserId;

      // Get recruiter ID if referral code exists
      let recruited_by_helper_id = null;
      if (referralCode) {
        const { data: recruiter } = await supabase
          .from("helpers")
          .select("id")
          .eq("referral_code", referralCode)
          .single();
        
        if (recruiter) {
          recruited_by_helper_id = recruiter.id;
        }
      }

      // Insert application with user_id
      const { data, error } = await supabase
        .from("helper_applications")
        .insert({
          user_id: userId,
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          why_helper: values.why_helper,
          bank_account_name: values.bank_account_name,
          bank_account_number: values.bank_account_number,
          bank_ifsc_code: values.bank_ifsc_code,
          bank_name: values.bank_name,
          recruited_by_helper_id,
        })
        .select()
        .single();

      if (error) throw error;

      setApplicationId(data.id.slice(0, 8).toUpperCase());
      setSubmitted(true);
      toast.success("Account created! Application submitted successfully!");
    } catch (error: any) {
      console.error("Error submitting application:", error);
      toast.error(error.message || "Failed to submit application. Please try again.");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl">Application Submitted Successfully! 🎉</CardTitle>
            <CardDescription className="text-lg mt-4">
              We'll review your application within 2-3 business days and notify you via email
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Application ID</p>
              <p className="text-2xl font-bold">#{applicationId}</p>
            </div>
            <Link to="/application-status">
              <Button className="w-full">Check Application Status</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Join Our Helper Program & Earn Commissions
          </h1>
          <p className="text-xl opacity-90 mb-8">
            Help businesses grow and earn money for every paying customer you bring
          </p>

          {recruiterName && (
            <div className="bg-primary-foreground text-primary p-4 rounded-lg inline-block mb-8">
              <p className="font-semibold">
                You're applying via <span className="text-primary">{recruiterName}'s</span> referral
              </p>
            </div>
          )}

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <DollarSign className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold">Earn 10% commission on every subscription you refer</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <Users className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold">Build your own helper network and earn additional 5%</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <MapPin className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold">Flexible working - work from anywhere</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
              <CheckCircle className="w-10 h-10 mx-auto mb-3" />
              <p className="font-semibold">No investment required - completely free to join</p>
            </div>
          </div>
        </div>
      </div>

      {/* Application Form */}
      <div className="max-w-3xl mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Application Form</CardTitle>
            <CardDescription>Fill in your details to become a helper</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign Up Option - Only show if not already a Google user */}
            {!isGoogleUser && (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Please sign in with Google to continue with your application
                </p>
                <Button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={isGoogleLoading}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing up...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>
            )}

            {isGoogleUser && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your full name"
                          {...field}
                          disabled={isGoogleUser}
                          className={isGoogleUser ? "bg-muted" : ""}
                        />
                      </FormControl>
                      {isGoogleUser && (
                        <p className="text-xs text-muted-foreground">Auto-filled from Google</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          {...field}
                          disabled={isGoogleUser}
                          className={isGoogleUser ? "bg-muted" : ""}
                        />
                      </FormControl>
                      {isGoogleUser && (
                        <p className="text-xs text-muted-foreground">Auto-filled from Google</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UPI Phone Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter 10-digit phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="why_helper"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Why do you want to become a helper?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us why you want to join our helper program"
                          className="min-h-32"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Bank Account Details</h3>

                  <FormField
                    control={form.control}
                    name="bank_account_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Holder Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="As per bank records" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank_account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter account number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank_ifsc_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IFSC Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., SBIN0001234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your bank name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>I agree to terms and conditions *</FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" size="lg">
                  Apply Now
                </Button>
              </form>
            </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
