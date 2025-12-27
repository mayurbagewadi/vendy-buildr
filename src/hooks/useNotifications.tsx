import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: 'order' | 'stock' | 'customer';
  createdAt: Date;
}

const LOW_STOCK_THRESHOLD = 5;
const NOTIFICATION_TIME_WINDOW_HOURS = 48; // Show notifications from last 48 hours

/**
 * Enterprise-grade notification hook
 * Fetches dynamic notifications from existing database tables
 * - New orders from orders table
 * - Low stock alerts from products table
 * - Real-time updates via Supabase subscriptions
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Calculate time threshold for recent notifications
  const getTimeThreshold = () => {
    const now = new Date();
    now.setHours(now.getHours() - NOTIFICATION_TIME_WINDOW_HOURS);
    return now.toISOString();
  };

  // Format time ago (e.g., "5 minutes ago", "2 hours ago")
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  };

  // Fetch notifications from existing database tables
  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }

      // Get user's store
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!store) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }

      const timeThreshold = getTimeThreshold();
      const allNotifications: Notification[] = [];

      // Fetch recent orders (new orders in last 48 hours)
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, created_at, status')
        .eq('store_id', store.id)
        .gte('created_at', timeThreshold)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentOrders) {
        recentOrders.forEach(order => {
          const createdAt = new Date(order.created_at);
          allNotifications.push({
            id: `order-${order.id}`,
            title: 'New Order Received',
            description: `Order #${order.order_number} from ${order.customer_name}`,
            time: formatTimeAgo(createdAt),
            unread: true, // All recent orders are unread
            type: 'order',
            createdAt,
          });
        });
      }

      // Fetch low stock products
      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock, updated_at')
        .eq('store_id', store.id)
        .eq('status', 'published') // Only check published products
        .lte('stock', LOW_STOCK_THRESHOLD)
        .gt('stock', 0) // Exclude out of stock
        .order('stock', { ascending: true })
        .limit(5);

      if (lowStockProducts) {
        lowStockProducts.forEach(product => {
          const updatedAt = new Date(product.updated_at || new Date());
          allNotifications.push({
            id: `stock-${product.id}`,
            title: 'Product Stock Low',
            description: `${product.name} is running low (${product.stock} left)`,
            time: formatTimeAgo(updatedAt),
            unread: true,
            type: 'stock',
            createdAt: updatedAt,
          });
        });
      }

      // Sort all notifications by creation time (newest first)
      allNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => n.unread).length);
      setIsLoading(false);
    } catch (error) {
      console.error('[useNotifications] Error fetching notifications:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Set up real-time subscriptions for new orders
    const ordersChannel = supabase
      .channel('notifications-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Refresh notifications when new order is inserted
          fetchNotifications();
        }
      )
      .subscribe();

    // Set up real-time subscriptions for product updates (stock changes)
    const productsChannel = supabase
      .channel('notifications-products')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        () => {
          // Refresh notifications when product stock is updated
          fetchNotifications();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  // Mark notification as read (in-memory only, no database table)
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, unread: false } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, unread: false }))
    );
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
