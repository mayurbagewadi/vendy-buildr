import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, XCircle } from "lucide-react";
import { AppLogo } from "@/components/ui/AppLogo";

const AUTH_PENDING_KEY = 'dd_auth_pending_v1';
const AUTH_PENDING_TTL_MS = 2 * 60 * 1000;
const CONNECTION_ERROR_MESSAGE = "Connection problem. Please check internet and try again.";
const RETRY_DELAY_MS = 700;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown) =>
  error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : '';

const isConfirmedDeletedUserError = (error: unknown) => {
  const status = error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
  const message = getErrorMessage(error).toLowerCase();

  return (
    (status === 403 || status === 404) &&
    message.includes('user') &&
    (message.includes('not found') || message.includes('does not exist') || message.includes('deleted'))
  );
};

const verifyCurrentUser = async () => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) return { status: 'ok' as const, user };
      if (isConfirmedDeletedUserError(error)) return { status: 'deleted' as const, error };

      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await sleep(RETRY_DELAY_MS);
  }

  return { status: 'connection_error' as const, error: lastError };
};

const retryQuery = async <T,>(operation: () => Promise<{ data: T | null; error: unknown }>) => {
  let result: { data: T | null; error: unknown };

  try {
    result = await operation();
  } catch (error) {
    result = { data: null, error };
  }

  if (!result.error) return result;

  await sleep(RETRY_DELAY_MS);

  try {
    result = await operation();
  } catch (error) {
    result = { data: null, error };
  }

  return result;
};

const isAuthPending = () => {
  const raw = sessionStorage.getItem(AUTH_PENDING_KEY);
  if (!raw) return false;

  const startedAt = Number(raw);
  if (!Number.isFinite(startedAt)) {
    sessionStorage.removeItem(AUTH_PENDING_KEY);
    return false;
  }

  if (Date.now() - startedAt > AUTH_PENDING_TTL_MS) {
    sessionStorage.removeItem(AUTH_PENDING_KEY);
    return false;
  }

  return true;
};

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [showDeletedAlert, setShowDeletedAlert] = useState(false);
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);

  const showConnectionError = () => {
    toast({
      variant: "destructive",
      title: "Connection problem",
      description: CONNECTION_ERROR_MESSAGE,
    });
    setIsProcessingOAuth(false);
    setIsLoading(false);
  };

  useEffect(() => {
    const authPending = isAuthPending();

    // Capture referral code from URL and store in sessionStorage
    const refParam = searchParams.get('ref');
    if (refParam) {
      console.log('[Auth] Referral code captured:', refParam);
      sessionStorage.setItem('referral_code', refParam);
    }

    // Check for account deletion error in URL params
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_deleted') {
      setShowDeletedAlert(true);
      // Remove the error param from URL without triggering navigation
      setSearchParams({});
    }

    // CRITICAL FIX: Detect if we're returning from OAuth callback
    // If URL has 'code' parameter, Supabase is processing OAuth - wait for onAuthStateChange
    const hasOAuthCode = searchParams.get('code') !== null;
    if (hasOAuthCode || authPending) {
      console.log('[Auth] OAuth callback detected - waiting for session to be established');
      setIsProcessingOAuth(true);
      if (hasOAuthCode) {
        // Don't call getSession() yet - let onAuthStateChange handle it
        return;
      }
    }

    // Check if user is already logged in (only when NOT processing OAuth callback)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] Checking existing session:', session ? 'Found' : 'None');

      if (session) {
        // CRITICAL: Verify user still exists in Supabase Auth (handles deleted accounts)
        const userVerification = await verifyCurrentUser();

        if (userVerification.status === 'deleted') {
          console.log('[Auth] User verification confirmed account deleted:', getErrorMessage(userVerification.error));
          await supabase.auth.signOut();
          sessionStorage.removeItem(AUTH_PENDING_KEY);
          window.location.href = '/?error=account_deleted';
          return;
        }

        if (userVerification.status === 'connection_error') {
          console.log('[Auth] User verification failed due to connection/API issue:', getErrorMessage(userVerification.error));
          showConnectionError();
          return;
        }

        if (!authPending) {
          setHasSession(true);
        }

        // First check if user is a helper
        console.log('[Auth] Checking for helper with ID:', session.user.id);
        const { data: helperData, error: helperError } = await retryQuery(() =>
          supabase
            .from('helpers')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
        );

        console.log('[Auth] Helper query result:', { helperData, helperError });

        if (helperError) {
          showConnectionError();
          return;
        }

        if (helperData) {
          console.log('[Auth] BDM found - redirecting to BDM dashboard');
          sessionStorage.removeItem(AUTH_PENDING_KEY);
          navigate("/bdm/dashboard");
          setIsLoading(false);
          return;
        }

        // Check if user has a store
        const { data: store, error } = await retryQuery(() =>
          supabase
            .from('stores')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle()
        );

        console.log('[Auth] Store query error:', error);
        console.log('[Auth] Store found:', store ? 'Yes' : 'No', store);

        if (error) {
          showConnectionError();
          return;
        }

        if (!store) {
          console.log('[Auth] No store found - redirecting to onboarding');
          sessionStorage.removeItem(AUTH_PENDING_KEY);
          navigate("/onboarding/store-setup");
        } else {
          console.log('[Auth] Redirecting to admin dashboard');

          // Show welcome toast only once per session (bottom-left positioned)
          if (!sessionStorage.getItem('welcomeShown')) {
            toast({
              title: "Welcome to your dashboard! 👋",
              description: "All systems are running smoothly.",
              className: "bottom-4 left-4 md:bottom-6 md:left-6",
            });
            sessionStorage.setItem('welcomeShown', 'true');
          }

          sessionStorage.removeItem(AUTH_PENDING_KEY);
          navigate("/admin/dashboard");
        }
        setIsLoading(false);
      }
    });

    // Listen for auth changes - CRITICAL: No async function to prevent deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event, session ? 'Session exists' : 'No session');

      if (event === 'SIGNED_IN' && session) {
        if (isAuthPending()) {
          setIsProcessingOAuth(true);
        } else {
          setHasSession(true);
        }

        // Defer database query to prevent auth deadlock
        setTimeout(async () => {
          try {
            // CRITICAL: Verify user still exists in Supabase Auth (handles deleted accounts)
            const userVerification = await verifyCurrentUser();

            if (userVerification.status === 'deleted') {
              console.log('[Auth] SIGNED_IN - User verification confirmed account deleted:', getErrorMessage(userVerification.error));
              await supabase.auth.signOut();
              sessionStorage.removeItem(AUTH_PENDING_KEY);
              window.location.href = '/?error=account_deleted';
              return;
            }

            if (userVerification.status === 'connection_error') {
              console.log('[Auth] SIGNED_IN - User verification failed due to connection/API issue:', getErrorMessage(userVerification.error));
              showConnectionError();
              return;
            }

            // First check if user is a helper
            console.log('[Auth] SIGNED_IN - Checking for helper with ID:', session.user.id);
            const { data: helperData, error: helperError } = await retryQuery(() =>
              supabase
                .from('helpers')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle()
            );

            console.log('[Auth] SIGNED_IN - Helper query result:', { helperData, helperError });

            if (helperError) {
              showConnectionError();
              return;
            }

            if (helperData) {
              console.log('[Auth] BDM found - redirecting to BDM dashboard');
              toast({
                title: "Welcome back!",
                description: "Redirecting to your BDM dashboard.",
              });
              sessionStorage.removeItem(AUTH_PENDING_KEY);
              navigate("/bdm/dashboard");
              return;
            }

            const { data: store, error } = await retryQuery(() =>
              supabase
                .from('stores')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle()
            );

            console.log('[Auth] After sign in - Query error:', error);
            console.log('[Auth] After sign in - Store found:', store ? 'Yes' : 'No', store);

            if (error) {
              showConnectionError();
              return;
            }

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
              sessionStorage.removeItem(AUTH_PENDING_KEY);
              navigate("/onboarding/store-setup");
            } else {
              console.log('[Auth] Existing user - redirecting to admin dashboard');

              // Show welcome toast only once per session (bottom-left positioned)
              if (!sessionStorage.getItem('welcomeShown')) {
                toast({
                  title: "Welcome to your dashboard! 👋",
                  description: "All systems are running smoothly.",
                  className: "bottom-4 left-4 md:bottom-6 md:left-6",
                });
                sessionStorage.setItem('welcomeShown', 'true');
              }

              sessionStorage.removeItem(AUTH_PENDING_KEY);
              navigate("/admin/dashboard");
            }
          } catch (error) {
            console.error('[Auth] Error checking store:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to verify account. Please try again.",
            });
            setIsProcessingOAuth(false);
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setIsProcessingOAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log('[Auth] Starting Google sign in...');
      sessionStorage.setItem(AUTH_PENDING_KEY, Date.now().toString());
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: 'https://www.googleapis.com/auth/drive.file',
        },
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        sessionStorage.removeItem(AUTH_PENDING_KEY);
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
      sessionStorage.removeItem(AUTH_PENDING_KEY);
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
      
      sessionStorage.clear();
      sessionStorage.removeItem(AUTH_PENDING_KEY);

      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });

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
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <AppLogo size={48} />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isProcessingOAuth ? (
            <div className="text-center space-y-4 py-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Please wait, we are setting up your account...
              </p>
            </div>
          ) : hasSession ? (
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
