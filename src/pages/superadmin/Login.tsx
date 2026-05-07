import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);

  const ALLOWED_DOMAIN = 'superadmin.digitaldukandar.in';

  useEffect(() => {
    const currentDomain = window.location.hostname;
    const isLovableDomain = currentDomain.endsWith('.lovable.app') ||
                            currentDomain.endsWith('.lovable.dev') ||
                            currentDomain.endsWith('.lovableproject.com');
    const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
    const isAllowedDomain = currentDomain === ALLOWED_DOMAIN;

    if (!isAllowedDomain && !isLocalhost && !isLovableDomain) {
      setIsUnauthorizedDomain(true);
    }
  }, []);

  // Handle OAuth callback — fires when Google redirects back with session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsGoogleLoading(true);
        try {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'super_admin')
            .maybeSingle();

          if (!roles) {
            await supabase.auth.signOut();
            toast({
              variant: "destructive",
              title: "Access Denied",
              description: "This Google account does not have super admin access.",
            });
            setIsGoogleLoading(false);
            return;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', session.user.id)
            .single();

          localStorage.setItem('superadmin_session', JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            id: session.user.id,
            email: session.user.email,
            fullName: profile?.full_name || 'Super Admin',
            loginAt: new Date().toISOString(),
            saved_at: Date.now(),
          }));

          toast({
            title: "Login Successful",
            description: "Welcome back to Super Admin Panel",
          });

          navigate("/superadmin/dashboard");
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message || "Authentication failed",
          });
          setIsGoogleLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/superadmin/login`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Sign In Failed",
        description: error.message || "Could not initiate Google sign in",
      });
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Login failed');
      }

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'super_admin');

      if (roleError) throw roleError;

      if (!roles || roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error('You do not have super admin access');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', authData.user.id)
        .single();

      // Fixed: localStorage (Guard reads localStorage) + tokens + saved_at
      localStorage.setItem('superadmin_session', JSON.stringify({
        access_token: authData.session!.access_token,
        refresh_token: authData.session!.refresh_token,
        id: authData.user.id,
        email: authData.user.email,
        fullName: profile?.full_name || 'Super Admin',
        loginAt: new Date().toISOString(),
        saved_at: Date.now(),
      }));

      if (rememberMe) {
        localStorage.setItem('superadmin_remember', 'true');
      }

      toast({
        title: "Login Successful",
        description: "Welcome back to Super Admin Panel",
      });

      navigate("/superadmin/dashboard");
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials or insufficient permissions",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Super Admin</CardTitle>
            <CardDescription className="mt-2">
              {isUnauthorizedDomain
                ? "Access Restricted"
                : "Enter your credentials to access the admin panel"
              }
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isUnauthorizedDomain ? (
            <div className="text-center space-y-4">
              <p className="text-destructive font-medium">
                Unauthorized Domain Access
              </p>
              <p className="text-sm text-muted-foreground">
                This super admin panel can only be accessed from authorized domains.
              </p>
              <p className="text-xs text-muted-foreground">
                Current domain: <span className="font-mono">{window.location.hostname}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || isGoogleLoading}
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
                    required
                    disabled={isLoading || isGoogleLoading}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={isLoading || isGoogleLoading}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Remember me
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
