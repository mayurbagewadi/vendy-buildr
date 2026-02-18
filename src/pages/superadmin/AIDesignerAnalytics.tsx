import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MetricsSummary {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  totalTokens: number;
  activeStores: number;
  cssSanitizedCount: number;
  publishedDesigns: number;
}

interface ModelStats {
  model: string;
  count: number;
  avgLatency: number;
  successRate: number;
}

const AIDesignerAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MetricsSummary>({
    totalRequests: 0,
    successRate: 0,
    avgLatency: 0,
    totalTokens: 0,
    activeStores: 0,
    cssSanitizedCount: 0,
    publishedDesigns: 0,
  });
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get summary metrics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: metrics, error } = await supabase
        .from("ai_designer_metrics")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      if (metrics && metrics.length > 0) {
        const totalRequests = metrics.length;
        const successCount = metrics.filter((m) => m.success).length;
        const totalLatency = metrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0);
        const totalTokens = metrics.reduce((sum, m) => sum + (m.tokens_consumed || 0), 0);
        const uniqueStores = new Set(metrics.map((m) => m.store_id)).size;
        const cssSanitizedCount = metrics.filter((m) => m.css_sanitized).length;
        const publishedDesigns = metrics.filter((m) => m.design_published).length;

        setSummary({
          totalRequests,
          successRate: (successCount / totalRequests) * 100,
          avgLatency: totalLatency / totalRequests,
          totalTokens,
          activeStores: uniqueStores,
          cssSanitizedCount,
          publishedDesigns,
        });

        // Calculate per-model stats
        const modelMap = new Map<string, { count: number; latency: number[]; success: number }>();

        metrics.forEach((m) => {
          if (!m.model_used) return;

          if (!modelMap.has(m.model_used)) {
            modelMap.set(m.model_used, { count: 0, latency: [], success: 0 });
          }

          const stats = modelMap.get(m.model_used)!;
          stats.count++;
          if (m.latency_ms) stats.latency.push(m.latency_ms);
          if (m.success) stats.success++;
        });

        const models: ModelStats[] = Array.from(modelMap.entries()).map(([model, stats]) => ({
          model,
          count: stats.count,
          avgLatency: stats.latency.length > 0
            ? stats.latency.reduce((a, b) => a + b, 0) / stats.latency.length
            : 0,
          successRate: (stats.success / stats.count) * 100,
        }));

        setModelStats(models.sort((a, b) => b.count - a.count));
      }
    } catch (error: any) {
      console.error("Failed to load analytics:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">AI Designer Analytics</h2>
        <p className="text-muted-foreground mt-2">
          Performance metrics and usage statistics (Last 30 days)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">AI design requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Successful responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.avgLatency / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">Response time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeStores}</div>
            <p className="text-xs text-muted-foreground">Using AI Designer</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Consumed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total AI tokens used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published Designs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.publishedDesigns}</div>
            <p className="text-xs text-muted-foreground">Designs applied to stores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Blocks</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.cssSanitizedCount}</div>
            <p className="text-xs text-muted-foreground">Malicious CSS blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {modelStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No model data available</p>
          ) : (
            <div className="space-y-4">
              {modelStats.map((model) => (
                <div key={model.model} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{model.model}</p>
                      <Badge variant="outline">{model.count} requests</Badge>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Avg Latency: {(model.avgLatency / 1000).toFixed(2)}s</span>
                      <span>Success Rate: {model.successRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIDesignerAnalytics;
