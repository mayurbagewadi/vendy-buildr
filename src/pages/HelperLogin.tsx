import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, ArrowLeft } from "lucide-react";

export default function HelperLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for existing session and handle OAuth redirects
  useEffect(() => {
    const checkHelperSession = async (userId: string) => {
      try {
        console.log('[HelperLogin] Checking helper status for user:', userId);

        // Check if user is an approved helper
        const { data: helperData, error: helperError } = await supabase
          .from('helpers')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (helperError) {
          console.error('[HelperLogin] Error checking helper status:', helperError);
          return;
        }

        if (helperData) {
          // User is an approved helper - redirect to dashboard
          console.log('[HelperLogin] Approved helper found, redirecting to dashboard');
          toast.success('Welcome back!');
          navigate('/helper/dashboard');
          return;
        }

        // Check if user has a pending application
        const { data: applicationData, error: appError } = await supabase
          .from('helper_applications')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (appError) {
          console.error('[HelperLogin] Error checking application:', appError);
          return;
        }

        if (applicationData) {
          // User has an application - redirect based on status
          console.log('[HelperLogin] Application found with status:', applicationData.application_status);

          if (applicationData.application_status === 'Pending') {
            toast.info('Your application is under review');
          } else if (applicationData.application_status === 'Rejected') {
            toast.error('Your helper application was rejected');
          } else {
            toast.info('Checking your application status...');
          }

          navigate('/application-status');
          return;
        }

        // User is not a helper and has no application
        console.log('[HelperLogin] No helper or application found');
        toast.error('You are not registered as a helper. Please apply to become a helper first.');
        await supabase.auth.signOut();
      } catch (error) {
        console.error('[HelperLogin] Error in session check:', error);
      }
    };

    // Check for existing session on page load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        console.log('[HelperLogin] Existing session found');
        await checkHelperSession(session.user.id);
      }
      setCheckingSession(false);
    });

    // Listen for auth state changes (OAuth redirects)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[HelperLogin] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session) {
        console.log('[HelperLogin] User signed in, checking helper status');
        setCheckingSession(true);

        // Defer check to avoid auth deadlock
        setTimeout(async () => {
          await checkHelperSession(session.user.id);
          setCheckingSession(false);
        }, 100);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('[HelperLogin] Starting Google sign in for helper...');

      // Google OAuth WITHOUT Drive scope (helpers don't need Drive access)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/helper/login`,
          // No scopes = only basic profile (email, name) - no Drive access
        },
      });

      if (error) {
        console.error('[HelperLogin] Google sign in error:', error);
        toast.error(error.message || "Failed to sign in with Google");
      } else {
        console.log('[HelperLogin] Google OAuth redirect initiated');
      }
    } catch (error: any) {
      console.error('[HelperLogin] Unexpected error:', error);
      toast.error(error.message || "An unexpected error occurred");
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
            {checkingSession ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Checking your session...</p>
              </div>
            ) : (
              <>
                {/* Google OAuth Login */}
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
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
                  Google
                </>
              )}
            </Button>

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
              </>
            )}
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
