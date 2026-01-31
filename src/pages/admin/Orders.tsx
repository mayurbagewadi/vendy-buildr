import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Package, Clock, CheckCircle2, XCircle, Download, Eye, Edit, Truck, Ban, AlertTriangle, ArrowUpCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { EditOrderModal } from "@/components/admin/EditOrderModal";
import { shiprocketLogin, shiprocketCreateOrder, convertToShiprocketOrder, shiprocketGetPickupLocations } from "@/lib/shiprocket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address: string;
  delivery_landmark?: string;
  delivery_pincode?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_time?: string;
  items: any;
  subtotal: number;
  delivery_charge: number;
  total: number;
  status: string;
  payment_method: string;
  notes?: string;
  created_at: string;
  coupon_code?: string;
  discount_amount?: number;
  automatic_discount_id?: string;
}

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [totalOrderCount, setTotalOrderCount] = useState<number>(0);
  const [viewLimit, setViewLimit] = useState<number | null>(null);
  const [planName, setPlanName] = useState<string>("");
  const [shiprocketConnected, setShiprocketConnected] = useState(false);
  const [shiprocketToken, setShiprocketToken] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState<string>("");
  const [packageDefaults, setPackageDefaults] = useState({ length: 10, breadth: 10, height: 10, weight: 0.5 });
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [orderToShip, setOrderToShip] = useState<Order | null>(null);
  const [shippingPopupEnabled, setShippingPopupEnabled] = useState(false);

  useEffect(() => {
    checkAuthAndLoadOrders();
  }, []);

  const checkAuthAndLoadOrders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/admin/login");
      return;
    }

    await loadOrders();
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: store } = await supabase
        .from("stores")
        .select("id, shiprocket_token, shiprocket_pickup_location, package_length, package_breadth, package_height, package_weight, shipping_popup_enabled")
        .eq("user_id", user.id)
        .single();

      if (!store) return;

      // Check shipping popup enabled setting
      setShippingPopupEnabled(store.shipping_popup_enabled || false);

      // Check Shiprocket connection
      if (store.shiprocket_token) {
        setShiprocketConnected(true);
        setShiprocketToken(store.shiprocket_token);

        // Get pickup location
        const locationsResult = await shiprocketGetPickupLocations(store.shiprocket_token);
        if (locationsResult.success && locationsResult.locations && locationsResult.locations.length > 0) {
          setPickupLocation(locationsResult.locations[0].pickup_location);
        }

        // Set package defaults
        if (store.package_length) setPackageDefaults(prev => ({ ...prev, length: store.package_length }));
        if (store.package_breadth) setPackageDefaults(prev => ({ ...prev, breadth: store.package_breadth }));
        if (store.package_height) setPackageDefaults(prev => ({ ...prev, height: store.package_height }));
        if (store.package_weight) setPackageDefaults(prev => ({ ...prev, weight: store.package_weight }));
      }

      // Get subscription and plan details to check view limit
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select(`
          subscription_plans (
            name,
            orders_view_limit
          )
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      // Determine the view limit (default to showing all if not set)
      let ordersViewLimit = null;
      if (subscription?.subscription_plans?.orders_view_limit) {
        const limit = subscription.subscription_plans.orders_view_limit;
        // 999999 represents unlimited
        ordersViewLimit = limit === 999999 ? null : limit;
      }

      // Store plan info in state
      setPlanName(subscription?.subscription_plans?.name || "");
      setViewLimit(ordersViewLimit);

      // Get total order count (before applying limit)
      const { count: totalCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id);

      setTotalOrderCount(totalCount || 0);

      // Fetch orders with limit if applicable
      // Strategy: Fetch OLDEST orders first (so Free plan only sees old orders)
      // Then REVERSE display order (so newest shows at top)
      let query = supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: true }); // Get oldest first from DB

      // Apply limit if set
      if (ordersViewLimit !== null) {
        query = query.limit(ordersViewLimit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Reverse the array to show newest first in UI
      // Free Plan: Fetches #1, #2 → Displays #2, #1
      // Pro Plan: Fetches all → Displays newest to oldest
      const reversedData = (data || []).reverse();
      setOrders(reversedData);
      setLastSync(new Date());
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

  const getFilteredOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_phone.includes(searchTerm) ||
          order.order_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.created_at);
        const orderDay = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

        switch (dateFilter) {
          case "today":
            return orderDay.getTime() === today.getTime();
          case "yesterday":
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return orderDay.getTime() === yesterday.getTime();
          case "last7days":
            const last7Days = new Date(today);
            last7Days.setDate(last7Days.getDate() - 7);
            return orderDay >= last7Days;
          case "last30days":
            const last30Days = new Date(today);
            last30Days.setDate(last30Days.getDate() - 30);
            return orderDay >= last30Days;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { label: "New", variant: "default" as const, icon: Clock },
      processing: { label: "Processing", variant: "secondary" as const, icon: Package },
      delivered: { label: "Delivered", variant: "default" as const, icon: CheckCircle2 },
      cancelled: { label: "Cancelled", variant: "destructive" as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getDiscountBadges = (order: Order) => {
    const hasCoupon = order.coupon_code && order.coupon_code.trim() !== "";
    const hasAutoDiscount = order.automatic_discount_id && order.automatic_discount_id.trim() !== "";

    if (!hasCoupon && !hasAutoDiscount) {
      return null;
    }

    return (
      <div className="flex gap-1 mb-1 -ml-1">
        {hasCoupon && (
          <Badge variant="outline" className="text-[10px] scale-75 origin-left bg-transparent border-purple-500 text-purple-900 dark:text-purple-300">
            {order.coupon_code}
          </Badge>
        )}
        {hasAutoDiscount && (
          <Badge variant="outline" className="text-[10px] scale-75 origin-left bg-transparent border-green-500 text-green-700 dark:text-green-400">
            Discount
          </Badge>
        )}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const exportToExcel = (month: string, year: string) => {
    const monthOrders = orders.filter((order) => {
      const orderDate = new Date(order.created_at);
      const orderMonth = orderDate.toLocaleDateString("en-US", { month: "long" });
      const orderYear = orderDate.getFullYear().toString();
      return orderMonth === month && orderYear === year;
    });

    if (monthOrders.length === 0) {
      toast({
        title: "No Orders",
        description: `No orders found for ${month} ${year}`,
        variant: "destructive",
      });
      return;
    }

    const exportData = monthOrders.map((order) => ({
      "Order Number": order.order_number,
      "Date": formatDate(order.created_at),
      "Time": formatTime(order.created_at),
      "Customer Name": order.customer_name,
      "Phone": order.customer_phone,
      "Email": order.customer_email || "N/A",
      "Address": order.delivery_address,
      "Items Count": Array.isArray(order.items) ? order.items.length : 0,
      "Items": Array.isArray(order.items) 
        ? order.items.map((item: any) => `${item.name} (${item.quantity}x)`).join(", ")
        : "N/A",
      "Amount": order.total,
      "Payment Method": order.payment_method,
      "Status": order.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${month}_${year}`);
    XLSX.writeFile(wb, `Orders_${month}_${year}.xlsx`);

    toast({
      title: "Export Successful",
      description: `Downloaded ${monthOrders.length} orders for ${month} ${year}`,
    });
  };

  const getCurrentMonthYear = () => {
    const now = new Date();
    return {
      month: now.toLocaleDateString("en-US", { month: "long" }),
      year: now.getFullYear().toString(),
    };
  };

  const getPreviousMonthYear = () => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return {
      month: now.toLocaleDateString("en-US", { month: "long" }),
      year: now.getFullYear().toString(),
    };
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setViewModalOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setEditModalOpen(true);
  };

  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Order updated successfully",
      });
      loadOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleShipClick = (order: Order) => {
    if (shippingPopupEnabled) {
      // Show modal with options
      setOrderToShip(order);
      setShipModalOpen(true);
    } else {
      // Direct action - mark as delivered
      handleMarkDelivered(order);
    }
  };

  const handleShipViaShiprocket = async () => {
    if (!orderToShip || !shiprocketToken) return;

    setShipModalOpen(false);
    setShippingOrderId(orderToShip.id);

    try {
      const shiprocketOrderData = convertToShiprocketOrder(orderToShip, pickupLocation, packageDefaults);
      const result = await shiprocketCreateOrder(shiprocketToken, shiprocketOrderData);

      if (result.success && result.data) {
        await supabase
          .from("orders")
          .update({
            shiprocket_order_id: result.data.order_id?.toString(),
            shiprocket_shipment_id: result.data.shipment_id?.toString(),
            status: "processing",
          })
          .eq("id", orderToShip.id);

        toast({
          title: "Order Created in Shiprocket",
          description: "Opening Shiprocket dashboard...",
        });

        window.open(`https://app.shiprocket.in/seller/orders/details/${result.data.order_id}`, "_blank");
        loadOrders();
      } else {
        toast({
          title: "Shiprocket Error",
          description: result.error || "Failed to create order in Shiprocket",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to ship order",
        variant: "destructive",
      });
    } finally {
      setShippingOrderId(null);
      setOrderToShip(null);
    }
  };

  const handleManualDelivery = async () => {
    if (!orderToShip) return;
    setShipModalOpen(false);
    await handleMarkDelivered(orderToShip);
    setOrderToShip(null);
  };

  const handleMarkDelivered = async (order: Order) => {
    await handleUpdateOrder(order.id, { status: "delivered" });
  };

  const handleCancelOrder = async (order: Order) => {
    await handleUpdateOrder(order.id, { status: "cancelled" });
  };

  const filteredOrders = getFilteredOrders();
  const todayOrders = orders.filter((order) => {
    const today = new Date();
    const orderDate = new Date(order.created_at);
    return orderDate.toDateString() === today.toDateString();
  });

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Orders Management
              {viewLimit !== null && totalOrderCount > 0 && (
                <span className="text-muted-foreground text-xl ml-2">
                  (Showing {Math.min(orders.length, viewLimit)} of {totalOrderCount})
                </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Track and manage customer orders (Auto-cleanup: Orders older than 2 months)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const prev = getPreviousMonthYear();
                exportToExcel(prev.month, prev.year);
              }}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Previous Month
            </Button>
            <Button
              onClick={() => {
                const curr = getCurrentMonthYear();
                exportToExcel(curr.month, curr.year);
              }}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Current Month
            </Button>
            <Button onClick={loadOrders} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Orders</p>
                <p className="text-2xl font-bold">{todayOrders.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Sync</p>
                <p className="text-sm font-medium">
                  {lastSync.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* View Limit Warning Banner */}
        {viewLimit !== null && totalOrderCount > viewLimit && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="ml-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">
                    {planName} Plan Limit
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    You can only view {viewLimit} orders. {totalOrderCount - viewLimit} more {totalOrderCount - viewLimit === 1 ? 'order is' : 'orders are'} hidden.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/admin/subscription")}
                  size="sm"
                  className="ml-4 flex-shrink-0"
                >
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search by name, phone, or order number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const hasCoupon = order.coupon_code && order.coupon_code.trim() !== "";
                    const hasAutoDiscount = order.automatic_discount_id && order.automatic_discount_id.trim() !== "";
                    const bothApplied = hasCoupon && hasAutoDiscount;
                    return (
                    <TableRow key={order.id} className={bothApplied ? "bg-red-100 dark:bg-red-950" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          {getDiscountBadges(order)}
                          <span>{order.order_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(order.created_at)}</div>
                          <div className="text-muted-foreground">{formatTime(order.created_at)}</div>
                        </div>
                      </TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell>{order.customer_phone}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {Array.isArray(order.items) ? order.items.length : 0} item{Array.isArray(order.items) && order.items.length !== 1 ? 's' : ''}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditOrder(order)}
                            title="Edit Order"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShipClick(order)}
                              title={shippingPopupEnabled ? "Ship Order" : "Mark as Delivered"}
                              className="text-blue-600 hover:text-blue-700"
                              disabled={shippingOrderId === order.id}
                            >
                              {shippingOrderId === order.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Truck className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {order.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelOrder(order)}
                              title="Cancel Order"
                              className="text-destructive hover:text-destructive"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            </div>
          )}
        </Card>

        {/* Modals */}
        <OrderDetailModal
          order={selectedOrder}
          open={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
        />
        <EditOrderModal
          order={selectedOrder}
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleUpdateOrder}
        />

        {/* Ship Order Modal */}
        <Dialog open={shipModalOpen} onOpenChange={setShipModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Ship Order
              </DialogTitle>
              <DialogDescription>
                {orderToShip && (
                  <span>Order #{orderToShip.order_number} • {orderToShip.customer_name}</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {shiprocketConnected && (
                <Button
                  onClick={handleShipViaShiprocket}
                  className="w-full h-14 justify-start gap-4"
                  variant="outline"
                >
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Ship via Shiprocket</div>
                    <div className="text-xs text-muted-foreground">Create shipment with courier partner</div>
                  </div>
                </Button>
              )}
              <Button
                onClick={handleManualDelivery}
                className="w-full h-14 justify-start gap-4"
                variant="outline"
              >
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Manual Delivery</div>
                  <div className="text-xs text-muted-foreground">Mark as delivered (self-delivery)</div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default Orders;
