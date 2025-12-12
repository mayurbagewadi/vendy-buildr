import { useState } from "react";
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
import { CheckCircle, Users, DollarSign, MapPin } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";

const formSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm_password: z.string().min(6, "Password must be at least 6 characters"),
  why_helper: z.string().min(50, "Please write at least 50 characters"),
  bank_account_name: z.string().min(2, "Account holder name is required"),
  bank_account_number: z.string().min(8, "Invalid account number"),
  bank_ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  bank_name: z.string().min(2, "Bank name is required"),
  terms: z.boolean().refine((val) => val === true, "You must agree to terms and conditions"),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type FormValues = z.infer<typeof formSchema>;

export default function BecomeHelper() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [recruiterName, setRecruiterName] = useState("");
  const referralCode = searchParams.get("ref");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
      confirm_password: "",
      why_helper: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_ifsc_code: "",
      bank_name: "",
      terms: false,
    },
  });

  // Load recruiter name if referral code exists
  useState(() => {
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
  });

  const onSubmit = async (values: FormValues) => {
    try {
      // Check if email exists in applications
      const { data: emailExists } = await supabase
        .from("helper_applications")
        .select("email")
        .eq("email", values.email)
        .maybeSingle();

      if (emailExists) {
        toast.error("This email is already registered as a helper");
        return;
      }

      // Check if phone exists
      const { data: phoneExists } = await supabase
        .from("helper_applications")
        .select("phone")
        .eq("phone", values.phone)
        .maybeSingle();

      if (phoneExists) {
        toast.error("This phone number is already registered");
        return;
      }

      // Check if this email is already registered as a store owner
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("user_id, email")
        .eq("email", values.email)
        .maybeSingle();

      if (existingProfile) {
        // Check if this user owns a store
        const { data: existingStore } = await supabase
          .from("stores")
          .select("id, store_name")
          .eq("user_id", existingProfile.user_id)
          .maybeSingle();

        if (existingStore) {
          toast.error("This email is already registered as a store owner. Store owners cannot become helpers. Please use a different email address.");
          return;
        }
      }

      // Create auth user first with email confirmation disabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.full_name,
            user_type: 'helper_applicant',
          },
          emailRedirectTo: `${window.location.origin}/application-status`,
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast.error("This email is already registered");
        } else {
          throw authError;
        }
        return;
      }

      if (!authData.user) {
        toast.error("Failed to create account");
        return;
      }

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
          user_id: authData.user.id,
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your full name" {...field} />
                      </FormControl>
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
                        <Input type="email" placeholder="Enter your email" {...field} />
                      </FormControl>
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
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Create a password (min 6 characters)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm your password" {...field} />
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
                      <FormLabel>Why do you want to become a helper? *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us why you want to join our helper program (minimum 50 characters)"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
