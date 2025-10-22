import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Store {
  id: string;
  name: string;
  slug: string;
  custom_domain: string;
  profiles: {
    email: string;
    full_name: string;
  };
}

const CustomDomainsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const superAdminSession = sessionStorage.getItem('superadmin_session');
      if (superAdminSession) {
        fetchStoresWithDomains();
        return;
      }

      // Check Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/superadmin/login');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin');

      if (!roles || roles.length === 0) {
        navigate('/superadmin/login');
        return;
      }

      fetchStoresWithDomains();
    };

    checkAuth();
  }, [navigate]);

  const fetchStoresWithDomains = async () => {
    try {
      const { data: storesData, error } = await supabase
        .from('stores')
        .select('id, name, slug, custom_domain, user_id')
        .not('custom_domain', 'is', null)
        .order('name');

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(storesData?.map(s => s.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

      // Combine data
      const combinedData = storesData?.map(store => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        custom_domain: store.custom_domain,
        profiles: profilesData?.find(p => p.user_id === store.user_id) || { email: '', full_name: '' }
      })) || [];

      setStores(combinedData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load custom domains",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/superadmin/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Custom Domains</h1>
              <p className="text-sm text-muted-foreground">
                Manage custom domains for stores
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">Loading domains...</div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No custom domains found
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{store.name}</p>
                          <p className="text-sm text-muted-foreground">{store.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{store.profiles?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {store.profiles?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://${store.custom_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {store.custom_domain}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toast({
                              title: "Coming soon",
                              description: "Domain management features",
                            })
                          }
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDomainsPage;
