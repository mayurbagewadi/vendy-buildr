import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Users, ArrowLeft } from "lucide-react";

export default function HelperLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    try {
      setLoading(true);

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Handle specific errors
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please check your credentials.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (!data.user) {
        toast.error("Login failed. Please try again.");
        return;
      }

      console.log("[HelperLogin] User ID:", data.user.id);
      console.log("[HelperLogin] User Email:", data.user.email);

      // Check if user is an approved helper
      const { data: helperData, error: helperError } = await supabase
        .from("helpers")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();

      console.log("[HelperLogin] Helper check - Error:", helperError);
      console.log("[HelperLogin] Helper check - Data:", helperData);

      if (helperError) {
        console.error("Error checking helper status:", helperError);
        toast.error("Failed to verify helper status");
        return;
      }

      if (helperData) {
        // User is an approved helper
        toast.success("Welcome back!");
        navigate("/helper/dashboard");
        return;
      }

      // Check if user has a pending application
      const { data: applicationData, error: appError } = await supabase
        .from("helper_applications")
        .select("*")
        .eq("user_id", data.user.id)
        .maybeSingle();

      console.log("[HelperLogin] Application check - Error:", appError);
      console.log("[HelperLogin] Application check - Data:", applicationData);

      if (applicationData) {
        // User has an application
        if (applicationData.application_status === "Pending") {
          toast.info("Your application is under review");
          navigate("/application-status");
        } else if (applicationData.application_status === "Rejected") {
          toast.error("Your helper application was rejected");
          navigate("/application-status");
        } else {
          toast.info("Checking your application status...");
          navigate("/application-status");
        }
        return;
      }

      // User is not a helper and has no application
      console.log("[HelperLogin] No helper or application found");
      toast.error("You are not registered as a helper. Please apply to become a helper first.");
      await supabase.auth.signOut();

    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Helper Login</CardTitle>
            <CardDescription>
              Sign in to access your helper dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="helper@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Don't have a helper account?
              </p>
              <Link to="/become-helper">
                <Button variant="link" className="text-blue-600 dark:text-blue-400">
                  Apply to become a helper
                </Button>
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                Are you a store owner?{" "}
                <Link to="/auth" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Login here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <p className="text-xs text-blue-900 dark:text-blue-200 text-center">
              <strong>Note:</strong> This login is exclusively for helpers. Store owners should use the main login page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
