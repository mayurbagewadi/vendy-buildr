import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from '@/hooks/use-toast';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Link as LinkIcon,
  Database,
  Clock,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { 
  getWebhookUrl, 
  saveWebhookUrl, 
  syncFromGoogleSheets,
  getLastSyncTime 
} from '@/lib/googleSheetsSync';
import { saveProducts } from '@/lib/productData';

const GoogleSheetsSync = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const savedUrl = getWebhookUrl();
    if (savedUrl) {
      setWebhookUrl(savedUrl);
    }
    
    const lastSyncTime = getLastSyncTime();
    setLastSync(lastSyncTime);
  }, []);

  const handleSaveWebhookUrl = () => {
    if (!webhookUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a webhook URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      new URL(webhookUrl);
      saveWebhookUrl(webhookUrl);
      toast({
        title: 'Success',
        description: 'Webhook URL saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
    }
  };

  const handleSync = async () => {
    const savedUrl = getWebhookUrl();
    if (!savedUrl) {
      toast({
        title: 'Error',
        description: 'Please save a webhook URL first',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      const products = await syncFromGoogleSheets(savedUrl);
      saveProducts(products);
      
      const syncTime = new Date().toISOString();
      setLastSync(syncTime);
      setSyncStatus('success');
      
      toast({
        title: 'Sync Successful',
        description: `Successfully synced ${products.length} products from Google Sheets`,
      });
    } catch (error) {
      setSyncStatus('error');
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync with Google Sheets',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Never';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Google Sheets Sync</h1>
          <p className="text-muted-foreground mt-2">
            Import products from your Google Sheets spreadsheet
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Sync Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                  <p className="font-medium">{formatLastSync(lastSync)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {syncStatus === 'success' && (
                      <Badge variant="default" className="bg-success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Success
                      </Badge>
                    )}
                    {syncStatus === 'error' && (
                      <Badge variant="destructive">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                    {syncStatus === 'idle' && (
                      <Badge variant="secondary">Idle</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <LinkIcon className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Connection</p>
                  <p className="font-medium">
                    {getWebhookUrl() ? 'Connected' : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Setup Instructions
            </CardTitle>
            <CardDescription>
              Follow these steps to connect your Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription className="space-y-4">
                <div>
                  <p className="font-semibold mb-2">Step 1: Create Google Apps Script</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                    <li>Open your Google Sheet</li>
                    <li>Go to Extensions → Apps Script</li>
                    <li>Replace the code with the webhook script</li>
                    <li>Deploy as Web App with "Anyone" access</li>
                    <li>Copy the deployment URL</li>
                  </ol>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold mb-2">Step 2: Required Columns</p>
                  <div className="grid grid-cols-2 gap-2 text-sm ml-2">
                    <div>• product_name</div>
                    <div>• category</div>
                    <div>• price_min</div>
                    <div>• price_max (optional)</div>
                    <div>• description</div>
                    <div>• status</div>
                    <div>• main_image</div>
                    <div>• additional_images (optional)</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="font-semibold mb-2">Apps Script Code:</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const jsonData = rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return ContentService
    .createTextOutput(JSON.stringify({ data: jsonData }))
    .setMimeType(ContentService.MimeType.JSON);
}`}
                  </pre>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Enter your Google Apps Script web app URL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  id="webhookUrl"
                  type="url"
                  placeholder="https://script.google.com/macros/s/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveWebhookUrl} variant="outline">
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                This URL will be used to fetch product data from your Google Sheet
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Sync Products</h3>
                <p className="text-sm text-muted-foreground">
                  Import products from your Google Sheet
                </p>
              </div>
              <Button 
                onClick={handleSync} 
                disabled={isSyncing || !getWebhookUrl()}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default GoogleSheetsSync;
