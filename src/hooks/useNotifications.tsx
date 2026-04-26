import { useState, useEffect, useRef } from "react";
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
const NOTIFICATION_TIME_WINDOW_HOURS = 48;

// localStorage key scoped per store — safe for multi-tenant (different owners, same browser)
const getStorageKey = (storeId: string) => `notif_seen_${storeId}`;

const getLastSeenAt = (storeId: string): Date => {
  try {
    const raw = localStorage.getItem(getStorageKey(storeId));
    return raw ? new Date(raw) : new Date(0); // epoch = first visit, everything is "new"
  } catch {
    return new Date(0);
  }
};

const saveLastSeenAt = (storeId: string, date: Date): void => {
  try {
    localStorage.setItem(getStorageKey(storeId), date.toISOString());
  } catch {}
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const storeIdRef = useRef<string | null>(null);

  const getTimeThreshold = () => {
    const now = new Date();
    now.setHours(now.getHours() - NOTIFICATION_TIME_WINDOW_HOURS);
    return now.toISOString();
  };

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

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setNotifications([]);
        setIsLoading(false);
        return;
      }

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

      storeIdRef.current = store.id;

      // Read persisted "last seen" timestamp — anything newer = unread
      const lastSeenAt = getLastSeenAt(store.id);
      const timeThreshold = getTimeThreshold();
      const allNotifications: Notification[] = [];

      // Recent orders (last 48 hours)
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
            unread: createdAt > lastSeenAt,
            type: 'order',
            createdAt,
          });
        });
      }

      // Low stock products
      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock, updated_at')
        .eq('store_id', store.id)
        .eq('status', 'published')
        .lte('stock', LOW_STOCK_THRESHOLD)
        .gt('stock', 0)
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
            unread: updatedAt > lastSeenAt,
            type: 'stock',
            createdAt: updatedAt,
          });
        });
      }

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

    const ordersChannel = supabase
      .channel('notifications-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        fetchNotifications();
      })
      .subscribe();

    const productsChannel = supabase
      .channel('notifications-products')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Saves current timestamp to localStorage — bell stays silent until a genuinely new event arrives
  const markAllSeen = () => {
    if (storeIdRef.current) {
      saveLastSeenAt(storeIdRef.current, new Date());
    }
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllSeen,
    refresh: fetchNotifications,
  };
}
