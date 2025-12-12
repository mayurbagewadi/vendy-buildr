import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

export default function SyncProfiles() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await fetch(
        `https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/sync-missing-profiles`,
        { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync profiles');
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: "Success",
        description: data.message,
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Sync Missing Profiles</CardTitle>
          <CardDescription>
            This tool will automatically create profile entries for any users in auth.users that don't have a corresponding profile record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSync} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Sync Profiles'}
          </Button>

          {result && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{result.message}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Profiles synced: {result.count}
              </p>
              {result.synced && result.synced.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Synced users:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside">
                    {result.synced.map((email: string) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
