import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Key,
  Code
} from 'lucide-react';
import { 
  getSpreadsheetId, 
  saveSpreadsheetId, 
  syncFromGoogleSheets,
  getLastSyncTime,
  pushToGoogleSheets,
  getScriptUrl,
  saveScriptUrl
} from '@/lib/googleSheetsSync';
import { saveProducts, getProducts } from '@/lib/productData';
import { 
  requestSheetsAccess, 
  getAccessToken, 
  getUserInfo,
  getGoogleClientId 
} from '@/lib/googleAuth';
import { SyncStatusBadge } from '@/components/admin/SyncStatusBadge';

const GoogleSheetsSync = () => {
  const [syncMethod, setSyncMethod] = useState<'script' | 'oauth'>('script');
  const [scriptUrl, setScriptUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasAccess, setHasAccess] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    const savedUrl = getScriptUrl();
    if (savedUrl) {
      setScriptUrl(savedUrl);
      setSyncMethod('script');
    }
    
    const savedId = getSpreadsheetId();
    if (savedId) {
      setSpreadsheetId(savedId);
      if (!savedUrl) setSyncMethod('oauth');
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

  const handleSaveScriptUrl = () => {
    if (!scriptUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid Script URL',
        variant: 'destructive',
      });
      return;
    }

    saveScriptUrl(scriptUrl);
    toast({
      title: 'Success',
      description: 'Script URL saved successfully',
    });
  };

  const handleSyncFromScript = async () => {
    const savedUrl = getScriptUrl();
    if (!savedUrl) {
      toast({
        title: 'Error',
        description: 'Please save a Script URL first',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');

    try {
      const response = await fetch(savedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch data from script');
      }

      const products = await response.json();
      saveProducts(products);
      
      const syncTime = new Date().toISOString();
      localStorage.setItem('google_sheets_last_sync', syncTime);
      setLastSync(syncTime);
      setSyncStatus('success');
      
      toast({
        title: 'Sync Successful',
        description: `Successfully synced ${products.length} products from Google Apps Script`,
      });
    } catch (error) {
      setSyncStatus('error');
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync from script',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushAllProducts = async () => {
    const savedUrl = getScriptUrl();
    if (!savedUrl) {
      toast({
        title: 'Error',
        description: 'Please configure and save your Script URL first',
        variant: 'destructive',
      });
      return;
    }

    const products = getProducts();
    if (products.length === 0) {
      toast({
        title: 'No Products',
        description: 'There are no products to push to Google Sheets',
        variant: 'destructive',
      });
      return;
    }

    setIsPushing(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const product of products) {
        try {
          await pushToGoogleSheets(product);
          successCount++;
        } catch (error) {
          console.error(`Failed to push product ${product.id}:`, error);
          failCount++;
        }
      }

      if (failCount === 0) {
        toast({
          title: 'Push Successful',
          description: `Successfully pushed ${successCount} products to Google Sheets`,
        });
      } else {
        toast({
          title: 'Push Completed with Errors',
          description: `Pushed ${successCount} products, ${failCount} failed`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Push Failed',
        description: error instanceof Error ? error.message : 'Failed to push to Google Sheets',
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleSync = async () => {
    if (syncMethod === 'script') {
      await handleSyncFromScript();
      return;
    }

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
                  <div className="mt-1">
                    <SyncStatusBadge isEnabled={!!scriptUrl || hasAccess} lastSync={lastSync} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Configuration</CardTitle>
            <CardDescription>
              Choose your preferred sync method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={syncMethod} onValueChange={(v) => setSyncMethod(v as 'script' | 'oauth')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="script" className="gap-2">
                  <Code className="w-4 h-4" />
                  Apps Script (Simple)
                </TabsTrigger>
                <TabsTrigger value="oauth" className="gap-2">
                  <Key className="w-4 h-4" />
                  OAuth (Advanced)
                </TabsTrigger>
              </TabsList>

              {/* Google Apps Script Method */}
              <TabsContent value="script" className="space-y-4">
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription className="space-y-2">
                    <p className="font-semibold">Simple Setup - No Google Login Required</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Open your Google Sheet</li>
                      <li>Go to Extensions → Apps Script</li>
                      <li>Paste the provided script code</li>
                      <li>Deploy as Web App</li>
                      <li>Copy the Web App URL and paste below</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="scriptUrl">Google Apps Script URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="scriptUrl"
                      type="url"
                      placeholder="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
                      value={scriptUrl}
                      onChange={(e) => setScriptUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleSaveScriptUrl} variant="outline">
                      Save
                    </Button>
                  </div>
                </div>

                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Apps Script Code</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-background p-4 rounded-md overflow-x-auto">
{`function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  var data = sheet.getDataRange().getValues();
  var products = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var priceMin = parseFloat(row[3]) || 0;
    var priceMax = row[4] ? parseFloat(row[4]) : priceMin;
    
    var images = [row[7]];
    if (row[8]) {
      images = images.concat(row[8].split(',').map(function(s) { return s.trim(); }));
    }
    
    products.push({
      id: row[0] || 'PROD' + (1000 + i),
      name: row[1],
      description: row[5],
      category: row[2],
      basePrice: priceMin,
      priceRange: priceMin !== priceMax ? priceMin + '-' + priceMax : undefined,
      stock: 100,
      status: row[6] && row[6].toLowerCase() === 'published' ? 'published' : 'draft',
      images: images,
      variants: priceMin !== priceMax ? [
        { name: 'Standard', price: priceMin },
        { name: 'Premium', price: priceMax }
      ] : undefined,
      createdAt: row[9] || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify(products))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
                  </CardContent>
                </Card>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Sync Products FROM Sheet</h3>
                    <p className="text-sm text-muted-foreground">
                      Import products from your Google Apps Script
                    </p>
                  </div>
                  <Button 
                    onClick={handleSync} 
                    disabled={isSyncing || !scriptUrl}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Push Products TO Sheet</h3>
                    <p className="text-sm text-muted-foreground">
                      Push all products from admin panel to Google Sheets
                    </p>
                  </div>
                  <Button 
                    onClick={handlePushAllProducts} 
                    disabled={isPushing || !scriptUrl}
                    className="gap-2"
                    variant="secondary"
                  >
                    <Database className={`w-4 h-4 ${isPushing ? 'animate-pulse' : ''}`} />
                    {isPushing ? 'Pushing...' : 'Push All Products'}
                  </Button>
                </div>
              </TabsContent>

              {/* OAuth Method */}
              <TabsContent value="oauth" className="space-y-4">
                {!hasAccess && (
                  <Alert className="border-warning">
                    <Key className="w-4 h-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Google Sheets Access Required</p>
                      <p className="text-sm mb-3">Click below to grant access to your Google Sheets</p>
                      <Button onClick={handleRequestAccess} size="sm" className="gap-2">
                        <Key className="w-4 h-4" />
                        Grant Sheets Access
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription className="space-y-2">
                    <p className="font-semibold">Advanced Method - Direct API Access</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                      <li>Sign in with Google (admin login)</li>
                      <li>Grant access to Google Sheets</li>
                      <li>Enter your Spreadsheet ID</li>
                      <li>Click "Sync Now"</li>
                    </ol>
                    <Separator className="my-2" />
                    <p className="text-sm font-semibold">Required Sheet Columns:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs ml-2">
                      <div>• A: product_id</div>
                      <div>• B: product_name</div>
                      <div>• C: category</div>
                      <div>• D: price_min</div>
                      <div>• E: price_max</div>
                      <div>• F: description</div>
                      <div>• G: status</div>
                      <div>• H: main_image</div>
                      <div>• I: additional_images</div>
                      <div>• J: date_added</div>
                    </div>
                  </AlertDescription>
                </Alert>

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
                    Find in URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default GoogleSheetsSync;
