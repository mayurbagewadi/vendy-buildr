import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface ProductsImportExportProps {
  onImportComplete?: () => void;
}

export const ProductsImportExport = ({ onImportComplete }: ProductsImportExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDropZone, setShowDropZone] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [needsExport, setNeedsExport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if products need export
  useEffect(() => {
    const checkExportNeeded = () => {
      const needsSync = localStorage.getItem('products_need_export') === 'true';
      setNeedsExport(needsSync);
    };

    checkExportNeeded();

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'products_need_export') {
        checkExportNeeded();
      }
    };

    // Listen for custom event when products change
    const handleProductChange = () => {
      localStorage.setItem('products_need_export', 'true');
      setNeedsExport(true);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('productChanged', handleProductChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('productChanged', handleProductChange);
    };
  }, []);

  // Export products
  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      setProgress(20);

      const response = await supabase.functions.invoke('export-to-sheets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setProgress(70);

      if (response.error) throw response.error;

      if (response.data.needsTemplate) {
        toast({
          title: "Template not found",
          description: "Please create a template first by clicking 'Create Template'.",
          variant: "destructive",
        });
        return;
      }

      const { productsCount, sheetUrl } = response.data;

      setProgress(100);

      // Clear export needed flag
      localStorage.removeItem('products_need_export');
      setNeedsExport(false);

      toast({
        title: "Export successful!",
        description: (
          <div className="space-y-2">
            <p>{productsCount} products exported to Google Sheets.</p>
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium block"
            >
              Open in Google Sheets →
            </a>
          </div>
        ),
      });

    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: "Error exporting products",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  // Import products
  const handleImport = async (sheetId?: string) => {
    setIsImporting(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      setProgress(20);

      const response = await supabase.functions.invoke('import-from-sheets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: sheetId ? { sheetId } : {},
      });

      setProgress(70);

      if (response.error) throw response.error;

      if (response.data.needsTemplate) {
        toast({
          title: "Template not found",
          description: "Please create a template first or provide a sheet URL.",
          variant: "destructive",
        });
        return;
      }

      const { created, updated, errors, totalErrors } = response.data;

      setProgress(100);

      if (totalErrors > 0) {
        toast({
          title: "Import completed with errors",
          description: `${created} created, ${updated} updated, ${totalErrors} errors occurred.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import successful!",
          description: `${created} products created, ${updated} products updated.`,
        });
      }

      // Reload products
      if (onImportComplete) {
        setTimeout(onImportComplete, 500);
      }

      setShowDropZone(false);

    } catch (error) {
      console.error('Error importing:', error);
      toast({
        title: "Error importing products",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  // Handle file drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Check if it's a Google Sheets file or link
    const text = await e.dataTransfer.getData('text');
    const sheetIdMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

    if (sheetIdMatch) {
      const sheetId = sheetIdMatch[1];
      handleImport(sheetId);
    } else {
      toast({
        title: "Invalid file",
        description: "Please drag a Google Sheets URL or share link.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || isImporting}
            className={needsExport && !isExporting ? "animate-pulse ring-2 ring-primary ring-offset-2" : ""}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
          {needsExport && !isExporting && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropZone(true)}
          disabled={isExporting || isImporting}
        >
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
      </div>

      {/* Progress indicator */}
      {(isExporting || isImporting) && progress > 0 && (
        <div className="w-full mt-4">
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Import Dialog with Drop Zone */}
      <Dialog open={showDropZone} onOpenChange={setShowDropZone}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Products from Google Sheets</DialogTitle>
            <DialogDescription>
              Choose how you want to import your products
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Import from template */}
            <Button
              onClick={() => handleImport()}
              disabled={isImporting}
              className="w-full"
              variant="default"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Import from Template Sheet
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">
                Drag & Drop Google Sheets Link
              </p>
              <p className="text-xs text-muted-foreground">
                Drag a Google Sheets URL or share link here
              </p>
            </div>

            {isImporting && progress > 0 && (
              <Progress value={progress} className="h-2" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
