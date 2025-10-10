import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ShoppingBag } from "lucide-react";
import { 
  initGoogleSignIn, 
  handleGoogleCallback, 
  saveUserInfo, 
  getGoogleClientId,
  saveGoogleClientId,
  isAuthenticated 
} from "@/lib/googleAuth";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    if (isAuthenticated()) {
      navigate("/admin/dashboard");
      return;
    }

    // Load saved client ID
    const savedClientId = getGoogleClientId();
    if (savedClientId) {
      setClientId(savedClientId);
      loadGoogleScript(savedClientId);
    }
  }, [navigate]);

  const loadGoogleScript = async (id: string) => {
    try {
      await initGoogleSignIn(id);
      setGoogleLoaded(true);
      
      // Initialize Google Sign-In button
      setTimeout(() => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: id,
            callback: handleCredentialResponse,
          });
          
          const buttonDiv = document.getElementById('google-signin-button');
          if (buttonDiv) {
            window.google.accounts.id.renderButton(
              buttonDiv,
              { theme: "outline", size: "large", width: 350 }
            );
          }
        }
      }, 100);
    } catch (error) {
      console.error('Failed to load Google Sign-In:', error);
    }
  };

  const handleCredentialResponse = (response: any) => {
    setIsLoading(true);
    try {
      const userInfo = handleGoogleCallback(response);
      
      // Save user info and auth
      saveUserInfo(userInfo);
      localStorage.setItem("adminAuth", "true");
      
      toast({
        title: "Success",
        description: `Welcome ${userInfo.name}!`,
      });
      
      setTimeout(() => {
        navigate("/admin/dashboard");
      }, 500);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid Google Client ID",
        variant: "destructive",
      });
      return;
    }
    
    saveGoogleClientId(clientId);
    loadGoogleScript(clientId);
    
    toast({
      title: "Success",
      description: "Client ID saved. You can now sign in.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <ShoppingBag className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Portal</h1>
          <p className="text-muted-foreground">Sign in with your Google account to access the admin panel</p>
        </div>

        <Card className="admin-card-elevated">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Welcome Back</CardTitle>
          </CardHeader>
          <CardContent>
            {!googleLoaded ? (
              <form onSubmit={handleSaveClientId} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">Google OAuth Client ID</Label>
                  <Input
                    id="clientId"
                    type="text"
                    placeholder="Enter your Google Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your Client ID from{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google Cloud Console
                    </a>
                  </p>
                </div>

                <Button type="submit" className="w-full admin-button-primary">
                  Save & Continue
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div 
                  id="google-signin-button" 
                  className="flex justify-center"
                />
                
                {isLoading && (
                  <p className="text-sm text-center text-muted-foreground">
                    Signing in...
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong className="block mb-2">Setup Instructions:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                <li>Create a project in Google Cloud Console</li>
                <li>Enable Google+ API</li>
                <li>Create OAuth 2.0 Client ID (Web application)</li>
                <li>Add authorized JavaScript origins</li>
                <li>Copy the Client ID and paste above</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure authentication powered by Google
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
