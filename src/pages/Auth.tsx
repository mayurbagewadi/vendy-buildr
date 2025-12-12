import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, XCircle } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [showDeletedAlert, setShowDeletedAlert] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Check for account deletion error in URL params
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_deleted') {
      setShowDeletedAlert(true);
      // Remove the error param from URL without triggering navigation
      setSearchParams({});
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] Checking existing session:', session ? 'Found' : 'None');
      
      if (session) {
        setHasSession(true);
        
        // First check if user is a helper
        const { data: helperData } = await supabase
          .from('helpers')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (helperData) {
          console.log('[Auth] Helper found - redirecting to helper dashboard');
          navigate("/helper/dashboard");
          setIsLoading(false);
          return;
        }

        // Check if user has a store
        const { data: store, error } = await supabase
          .from('stores')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        console.log('[Auth] Store query error:', error);
        console.log('[Auth] Store found:', store ? 'Yes' : 'No', store);

        if (!store) {
          console.log('[Auth] No store found - redirecting to onboarding');
          navigate("/onboarding/store-setup");
        } else {
          console.log('[Auth] Redirecting to admin dashboard');
          navigate("/admin/dashboard");
        }
        setIsLoading(false);
      }
    });

    // Listen for auth changes - CRITICAL: No async function to prevent deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      if (event === 'SIGNED_IN' && session) {
        setHasSession(true);
        
        // Defer database query to prevent auth deadlock
        setTimeout(async () => {
          try {
            // First check if user is a helper
            const { data: helperData } = await supabase
              .from('helpers')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (helperData) {
              console.log('[Auth] Helper found - redirecting to helper dashboard');
              toast({
                title: "Welcome back!",
                description: "Redirecting to your helper dashboard.",
              });
              navigate("/helper/dashboard");
              return;
            }

            const { data: store, error } = await supabase
              .from('stores')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle();

            console.log('[Auth] After sign in - Query error:', error);
            console.log('[Auth] After sign in - Store found:', store ? 'Yes' : 'No', store);

            // Save Google Drive tokens if available
            const providerToken = session.provider_token;
            const providerRefreshToken = session.provider_refresh_token;
            
            if (store && providerToken) {
              console.log('[Auth] Saving Google Drive tokens to store');
              const updates: any = {
                google_access_token: providerToken,
              };

              if (providerRefreshToken) {
                const expiryTime = new Date(Date.now() + 3600 * 1000); // 1 hour from now
                updates.google_refresh_token = providerRefreshToken;
                updates.google_token_expiry = expiryTime.toISOString();
              }
              
              await supabase
                .from('stores')
                .update(updates)
                .eq('id', store.id);
            }

            if (!store) {
              console.log('[Auth] No store found - redirecting to onboarding');
              toast({
                title: "Welcome!",
                description: "Let's set up your store.",
              });
              navigate("/onboarding/store-setup");
            } else {
              console.log('[Auth] Existing user - redirecting to admin dashboard');
              toast({
                title: "Success",
                description: providerToken ? "Welcome back! Google Drive connected." : "Welcome back!",
              });
              navigate("/admin/dashboard");
            }
          } catch (error) {
            console.error('[Auth] Error checking store:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to verify account. Please try again.",
            });
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log('[Auth] Starting Google sign in...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: 'https://www.googleapis.com/auth/drive.file',
        },
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        console.log('[Auth] OAuth redirect initiated');
      }
    } catch (error) {
      console.error('[Auth] Unexpected error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter both email and password",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('[Auth] Starting email/password sign in...');
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);

        // Handle email not confirmed error specifically
        if (error.message.includes("Email not confirmed")) {
          toast({
            variant: "destructive",
            title: "Email Not Confirmed",
            description: "Please check your email and click the confirmation link we sent you. Check your spam folder if you don't see it.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message,
          });
        }
      } else {
        console.log('[Auth] Sign in successful');
      }
    } catch (error) {
      console.error('[Auth] Unexpected error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      
      // Reload to clear state
      window.location.reload();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Critical Account Deleted Alert - Centered and Prominent */}
        {showDeletedAlert && (
          <Alert variant="destructive" className="border-2 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-lg font-semibold mb-2">
                  Account Deleted
                </AlertTitle>
                <AlertDescription className="text-base">
                  Your account has been deleted by the administrator. All your data has been removed from the system.
                </AlertDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => setShowDeletedAlert(false)}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
          </Alert>
        )}

        <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSession ? (
            <>
              <div className="text-center space-y-2 py-2">
                <p className="text-sm text-muted-foreground">
                  You're already signed in
                </p>
                <p className="text-xs text-muted-foreground">
                  Redirecting to your dashboard...
                </p>
              </div>
              <Button
                onClick={handleSignOut}
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  "Sign out"
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Email/Password Login Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in with Email"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Google OAuth Login */}
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {isLoading ? (
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

              <p className="text-xs text-center text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
