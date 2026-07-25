import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Clock, ExternalLink, Loader2, Package, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStorefront } from "@/contexts/StoreContext";
import Header from "@/components/customer/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TrackingEvent {
  status: string;
  status_label: string;
  location: string | null;
  message: string | null;
  happened_at: string | null;
}

interface TrackingData {
  provider: string;
  awb: string;
  status: string;
  status_label: string;
  customer_tracking_url: string;
  official_tracking_url: string;
  last_synced_at: string | null;
  order_number: string | null;
  order_date: string | null;
  store: {
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  events: TrackingEvent[];
}

const formatDateTime = (value: string | null) => {
  if (!value) return "Not updated yet";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "text-green-700 bg-green-50 border-green-200";
  if (normalized.includes("failed") || normalized.includes("rto") || normalized.includes("return")) {
    return "text-red-700 bg-red-50 border-red-200";
  }
  return "text-blue-700 bg-blue-50 border-blue-200";
};

const Tracking = () => {
  const { awb } = useParams<{ awb: string }>();
  const { store, storeId, storeSlug, loading: storeLoading } = useStorefront();
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!awb) {
      setError("Tracking number is missing");
      setLoading(false);
      return;
    }

    if (storeLoading) return;

    const loadTracking = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: functionError } = await supabase.functions.invoke("public-shipment-tracking", {
          body: {
            awb,
            store_id: storeId || undefined,
          },
        });

        if (functionError) throw functionError;
        if (data?.error) throw new Error(data.error);
        setTracking(data.shipment);
      } catch (loadError: any) {
        setError(loadError.message || "Unable to load tracking");
      } finally {
        setLoading(false);
      }
    };

    loadTracking();
  }, [awb, storeId, storeLoading]);

  const homeHref = storeSlug ? `/${storeSlug}` : "/";
  const storeName = store?.name || tracking?.store?.name || "Store";

  return (
    <>
      <Header storeSlug={storeSlug || undefined} storeId={storeId || undefined} />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
          <div className="mb-6">
            <Link to={homeHref} className="text-sm text-muted-foreground hover:text-foreground">
              Back to store
            </Link>
          </div>

          <Card>
            <CardContent className="p-6 sm:p-8">
              {loading ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="space-y-4 text-center">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div>
                    <h1 className="text-xl font-semibold">Tracking not found</h1>
                    <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link to={homeHref}>Go to store</Link>
                  </Button>
                </div>
              ) : tracking ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{storeName}</p>
                      <h1 className="mt-1 text-2xl font-bold">Order Tracking</h1>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusTone(tracking.status)}`}>
                      {tracking.status_label}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Courier</p>
                      <p className="mt-1 flex items-center gap-2 font-semibold">
                        <Truck className="h-4 w-4" />
                        Delhivery
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">AWB</p>
                      <p className="mt-1 font-mono font-semibold">{tracking.awb}</p>
                    </div>
                    {tracking.order_number && (
                      <div className="rounded-lg border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Order</p>
                        <p className="mt-1 font-semibold">{tracking.order_number}</p>
                      </div>
                    )}
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="mt-1 font-semibold">{formatDateTime(tracking.last_synced_at)}</p>
                    </div>
                  </div>

                  <div>
                    <h2 className="mb-3 text-sm font-semibold">Shipment Timeline</h2>
                    {tracking.events.length > 0 ? (
                      <div className="space-y-3">
                        {tracking.events.map((event, index) => (
                          <div key={`${event.status}-${event.happened_at}-${index}`} className="flex gap-3 rounded-lg border p-4">
                            <div className="mt-0.5">
                              {index === 0 ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {event.status_label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDateTime(event.happened_at)}</span>
                              </div>
                              {event.message && <p className="mt-2 text-sm">{event.message}</p>}
                              {event.location && <p className="mt-1 text-xs text-muted-foreground">{event.location}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                        Tracking details will appear after the courier updates this shipment.
                      </div>
                    )}
                  </div>

                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <a href={tracking.official_tracking_url} target="_blank" rel="noopener noreferrer">
                      Open Delhivery official tracking
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default Tracking;
