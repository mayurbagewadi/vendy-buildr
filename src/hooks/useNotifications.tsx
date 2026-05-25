import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: "new_order" | "paid_order" | "low_stock" | "test";
  createdAt: Date;
  actionUrl?: string | null;
}

const MAX_NOTIFICATIONS = 30;

const TAB_ID: string =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const formatTimeAgo = (date: Date): string => {
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) {
    const m = Math.floor(diffInSeconds / 60);
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (diffInSeconds < 86400) {
    const h = Math.floor(diffInSeconds / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const d = Math.floor(diffInSeconds / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
};

const mapEvent = (event: any): Notification => {
  const createdAt = new Date(event.created_at);
  return {
    id: event.id,
    title: event.title,
    description: event.body,
    time: formatTimeAgo(createdAt),
    unread: !event.read_at,
    type: event.type,
    createdAt,
    actionUrl: event.action_url,
  };
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const storeIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const fetchFromDB = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mountedRef.current) return null;

      if (!storeIdRef.current) {
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!store || !mountedRef.current) return null;
        storeIdRef.current = store.id;
      }

      const storeId = storeIdRef.current;
      const { data, error } = await (supabase as any)
        .from("notification_events")
        .select("id, title, body, type, action_url, read_at, created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (error) throw error;
      if (!mountedRef.current) return storeId;

      const mapped = (data || []).map(mapEvent);
      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => n.unread).length);
      setIsLoading(false);

      return storeId;
    } catch (err) {
      console.error("[useNotifications] DB fetch failed:", err);
      if (mountedRef.current) setIsLoading(false);
      return null;
    }
  }, []);

  const handleNewEvent = useCallback((payload: any) => {
    if (!mountedRef.current || !payload.new?.id) return;

    const incoming = mapEvent(payload.new);

    setNotifications((prev) => {
      if (prev.some((n) => n.id === incoming.id)) return prev;
      return [incoming, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
    setUnreadCount((prev) => prev + 1);

    if (incoming.type !== "test") {
      toast({
        title: incoming.title,
        description: incoming.description,
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cleanupChannels: (() => void) | null = null;

    fetchFromDB().then((storeId) => {
      if (!storeId || !mountedRef.current) return;

      const channel = supabase
        .channel(`notification-events-${storeId}-${TAB_ID}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notification_events",
            filter: `store_id=eq.${storeId}`,
          },
          handleNewEvent
        )
        .subscribe();

      cleanupChannels = () => {
        supabase.removeChannel(channel);
      };
    });

    return () => {
      mountedRef.current = false;
      cleanupChannels?.();
    };
  }, [fetchFromDB, handleNewEvent]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === notificationId ? { ...n, unread: false } : n)
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await (supabase as any)
      .from("notification_events")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .is("read_at", null);
  }, []);

  const markAllSeen = useCallback(async () => {
    const storeId = storeIdRef.current;
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);

    if (storeId) {
      await (supabase as any)
        .from("notification_events")
        .update({ read_at: new Date().toISOString() })
        .eq("store_id", storeId)
        .is("read_at", null);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllSeen,
    refresh: fetchFromDB,
  };
}
