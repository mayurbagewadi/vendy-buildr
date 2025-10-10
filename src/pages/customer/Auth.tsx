import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { initGoogleSignIn, handleGoogleCallback, getGoogleClientId, saveGoogleClientId } from '@/lib/googleAuth';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const CustomerAuth = () => {
  const [clientId, setClientId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home');
      return;
    }

    const storedClientId = getGoogleClientId();
    if (storedClientId) {
      setClientId(storedClientId);
      loadGoogleScript(storedClientId);
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, navigate]);

  const loadGoogleScript = async (clientId: string) => {
    try {
      await initGoogleSignIn(clientId);
      
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
        
        window.google.accounts.id.renderButton(
          document.getElementById('googleSignInButton'),
          { 
            theme: 'outline', 
            size: 'large',
            width: 300,
            text: 'continue_with'
          }
        );
        
        setGoogleLoaded(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load Google Sign-In',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialResponse = (response: any) => {
    try {
      const userInfo = handleGoogleCallback(response);
      login(userInfo);
      
      toast({
        title: 'Success',
        description: 'Successfully signed in!',
      });
      
      navigate('/home');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign in with Google',
        variant: 'destructive',
      });
    }
  };

  const handleSaveClientId = () => {
    if (clientId.trim()) {
      saveGoogleClientId(clientId);
      loadGoogleScript(clientId);
      toast({
        title: 'Success',
        description: 'Google Client ID saved',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/home" className="inline-flex items-center gap-2 text-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <Card>
          <CardHeader className="space-y-2 text-center">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-2">
              <ShoppingCart className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Welcome to MyStore</CardTitle>
            <CardDescription>
              Sign in with your Google account to continue shopping
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : !googleLoaded ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">Google Client ID</Label>
                  <Input
                    id="clientId"
                    type="text"
                    placeholder="Enter Google Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Administrator needs to configure Google OAuth to enable sign in.
                  </p>
                </div>
                <Button onClick={handleSaveClientId} className="w-full">
                  Save Configuration
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div 
                  id="googleSignInButton" 
                  className="flex justify-center"
                />
                <p className="text-xs text-center text-muted-foreground">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerAuth;
