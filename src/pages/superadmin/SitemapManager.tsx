import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const SUPABASE_FUNCTION_URL = 'https://vexeuxsvckpfvuxqchqu.supabase.co/functions/v1/submit-sitemap-to-google';

export default function SitemapManager() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const submitAllSitemaps = async () => {
    try {
      setLoading(true);
      setResults([]);

      toast({
        title: "Submitting sitemaps...",
        description: "This may take a few minutes for all stores.",
      });

      // Call Edge Function to submit all stores
      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body = process all stores
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        toast({
          title: "Sitemaps submitted!",
          description: `Successfully processed ${data.processed} stores.`,
        });
      } else {
        throw new Error(data.error || 'Failed to submit sitemaps');
      }
    } catch (error) {
      console.error('Error submitting sitemaps:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit sitemaps",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Google Search Console Sitemap Manager</CardTitle>
          <CardDescription>
            Automatically submit sitemaps for all stores to Google Search Console
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This tool will automatically submit sitemaps for all stores with subdomains or custom domains
              to Google Search Console. New stores will automatically get their sitemaps submitted.
            </p>

            <Button
              onClick={submitAllSitemaps}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Sitemaps...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Submit All Sitemaps to Google
                </>
              )}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Submission Results:</h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{result.domain}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.sitemapUrl}
                      </p>
                      {result.message && (
                        <p className="text-xs mt-1">
                          {result.message}
                        </p>
                      )}
                      {result.error && (
                        <p className="text-xs text-destructive mt-1">
                          {result.error}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">How it works:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Automatically submits sitemaps when new stores are created</li>
              <li>Automatically re-submits when subdomain or custom domain changes</li>
              <li>Uses Google Search Console API for instant submission</li>
              <li>No manual work needed for each store</li>
              <li>Tracks submission status in database</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p className="text-sm font-semibold text-yellow-800">Setup Required:</p>
            <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside mt-2">
              <li>Create Google Cloud Project</li>
              <li>Enable Google Search Console API</li>
              <li>Create Service Account and download JSON key</li>
              <li>Add service account email to Google Search Console as owner for each domain</li>
              <li>Add credentials to Supabase environment variables:
                <ul className="ml-6 mt-1 space-y-1 list-disc">
                  <li><code className="text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code></li>
                  <li><code className="text-xs">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code></li>
                </ul>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
