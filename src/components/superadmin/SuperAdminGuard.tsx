import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function SuperAdminGuard() {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const restoreAndValidateSession = async () => {
      console.log('[SuperAdminGuard] Checking session...');

      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        // Check if current session is superadmin
        if (session?.user) {
          console.log('[SuperAdminGuard] Current user:', session.user.id);

          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'super_admin')
            .maybeSingle();

          if (roles) {
            console.log('[SuperAdminGuard] Valid superadmin session found');
            setAuthorized(true);
            setReady(true);
            return;
          }
        }

        // Current session is not superadmin - check for stored session
        const storedSession = localStorage.getItem('superadmin_session');
        console.log('[SuperAdminGuard] Stored session found:', !!storedSession);

        if (storedSession) {
          try {
            const sessionData = JSON.parse(storedSession);

            // Validate session data structure
            if (!sessionData.access_token || !sessionData.refresh_token) {
              console.warn('[SuperAdminGuard] Invalid stored session structure');
              localStorage.removeItem('superadmin_session');
              setAuthorized(false);
              setReady(true);
              return;
            }

            // Check if session is not too old (optional: 24 hours max)
            const savedAt = sessionData.saved_at || 0;
            const ageHours = (Date.now() - savedAt) / (1000 * 60 * 60);
            if (ageHours > 24) {
              console.warn('[SuperAdminGuard] Stored session too old:', ageHours, 'hours');
              localStorage.removeItem('superadmin_session');
              setAuthorized(false);
              setReady(true);
              return;
            }

            console.log('[SuperAdminGuard] Restoring superadmin session...');

            // Restore the session
            const { error } = await supabase.auth.setSession({
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token,
            });

            if (error) {
              console.error('[SuperAdminGuard] Session restoration failed:', error);
              localStorage.removeItem('superadmin_session');
              setAuthorized(false);
              setReady(true);
              return;
            }

            // Clear the stored session after successful restoration
            localStorage.removeItem('superadmin_session');

            // Brief delay to ensure Supabase internal state settles
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify the restored session is actually superadmin
            const { data: { session: restoredSession } } = await supabase.auth.getSession();

            if (restoredSession?.user) {
              const { data: verifyRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', restoredSession.user.id)
                .eq('role', 'super_admin')
                .maybeSingle();

              if (verifyRoles) {
                console.log('[SuperAdminGuard] Session restored and verified successfully');
                setAuthorized(true);
                setReady(true);
                return;
              }
            }

            console.warn('[SuperAdminGuard] Restored session is not superadmin');
            setAuthorized(false);
            setReady(true);
            return;

          } catch (error) {
            console.error('[SuperAdminGuard] Error during restoration:', error);
            localStorage.removeItem('superadmin_session');
            setAuthorized(false);
            setReady(true);
            return;
          }
        }

        // No valid session found
        console.log('[SuperAdminGuard] No valid superadmin session');
        setAuthorized(false);
        setReady(true);

      } catch (error) {
        console.error('[SuperAdminGuard] Unexpected error:', error);
        setAuthorized(false);
        setReady(true);
      }
    };

    restoreAndValidateSession();
  }, [location.key]); // Runs on back/forward navigation

  // Show loading state while checking/restoring session
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Restoring admin session...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authorized
  if (!authorized) {
    return <Navigate to="/superadmin/login" replace />;
  }

  // Render child routes
  return <Outlet />;
}
