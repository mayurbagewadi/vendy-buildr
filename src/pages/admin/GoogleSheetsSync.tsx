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
  Info,
  Key
} from 'lucide-react';
import { 
  getSpreadsheetId, 
  saveSpreadsheetId, 
  syncFromGoogleSheets,
  getLastSyncTime 
} from '@/lib/googleSheetsSync';
import { saveProducts } from '@/lib/productData';
import { 
  requestSheetsAccess, 
  getAccessToken, 
  getUserInfo,
  getGoogleClientId 
} from '@/lib/googleAuth';

const GoogleSheetsSync = () => {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const savedId = getSpreadsheetId();
    if (savedId) {
      setSpreadsheetId(savedId);
    }
    
    const lastSyncTime = getLastSyncTime();
    setLastSync(lastSyncTime);

    const token = getAccessToken();
    setHasAccess(!!token);
  }, []);

  const handleRequestAccess = async () => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      toast({
        title: 'Error',
        description: 'Please sign in with Google first',
        variant: 'destructive',
      });
      return;
    }

    try {
      await requestSheetsAccess(clientId);
      setHasAccess(true);
      toast({
        title: 'Success',
        description: 'Google Sheets access granted',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get Google Sheets access',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSpreadsheetId = () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Spreadsheet ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      saveSpreadsheetId(spreadsheetId);
      toast({
        title: 'Success',
        description: 'Spreadsheet ID saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Spreadsheet ID',
        variant: 'destructive',
      });
    }
  };

  const handleSync = async () => {
    if (!hasAccess) {
      toast({
        title: 'Error',
        description: 'Please grant Google Sheets access first',
        variant: 'destructive',
      });
      return;
    }

    const savedId = getSpreadsheetId();
    if (!savedId) {
      toast({
        title: 'Error',
        description: 'Please save a Spreadsheet ID first',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      const products = await syncFromGoogleSheets(savedId);
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

  const userInfo = getUserInfo();

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-medium text-xs">{userInfo?.email || 'Not signed in'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                  <p className="font-medium">{formatLastSync(lastSync)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <AlertCircle className="w-5 h-5 text-primary" />
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
                  <p className="text-sm text-muted-foreground">Sheets Access</p>
                  <p className="font-medium">
                    {hasAccess ? 'Granted' : 'Not granted'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grant Access Card */}
        {!hasAccess && (
          <Card className="border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Grant Google Sheets Access
              </CardTitle>
              <CardDescription>
                Click the button below to allow this app to read your Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRequestAccess} className="gap-2">
                <Key className="w-4 h-4" />
                Grant Sheets Access
              </Button>
            </CardContent>
          </Card>
        )}

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
                  <p className="font-semibold mb-2">Required Steps:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                    <li>Sign in with Google (admin login)</li>
                    <li>Grant access to Google Sheets (button above)</li>
                    <li>Enter your Spreadsheet ID below</li>
                    <li>Click "Sync Now" to import products</li>
                  </ol>
                </div>
                
                <Separator />
                
                <div>
                  <p className="font-semibold mb-2">Required Sheet Columns (in order):</p>
                  <div className="grid grid-cols-2 gap-2 text-sm ml-2">
                    <div>• Column A: product_id (optional)</div>
                    <div>• Column B: product_name</div>
                    <div>• Column C: category</div>
                    <div>• Column D: price_min</div>
                    <div>• Column E: price_max (optional)</div>
                    <div>• Column F: description</div>
                    <div>• Column G: status (published/draft)</div>
                    <div>• Column H: main_image (URL)</div>
                    <div>• Column I: additional_images (comma-separated)</div>
                    <div>• Column J: date_added (optional)</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: First row should be headers, data starts from row 2
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Spreadsheet Configuration</CardTitle>
            <CardDescription>
              Enter your Google Spreadsheet ID
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
              <div className="flex gap-2">
                <Input
                  id="spreadsheetId"
                  type="text"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveSpreadsheetId} variant="outline">
                  Save
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Find the ID in your Google Sheets URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
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
                disabled={isSyncing || !hasAccess || !getSpreadsheetId()}
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
