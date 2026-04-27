import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

const renderBody = (text: string) =>
  text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-1" />;
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      return (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
          <span className="text-sm text-muted-foreground leading-relaxed">{trimmed.replace(/^[-•]\s/, '')}</span>
        </div>
      );
    }
    return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{trimmed}</p>;
  });

const CATEGORY_COLORS: Record<string, string> = {
  Feature: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'UI Update': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  Fix: 'bg-red-500/10 text-red-600 border-red-500/20',
  Announcement: 'bg-green-500/10 text-green-600 border-green-500/20',
};

interface PushNotificationCardProps {
  storeCreatedAt: string | null;
  storeLoaded: boolean;
}

const PushNotificationCard = ({ storeCreatedAt, storeLoaded }: PushNotificationCardProps) => {
  const [visible, setVisible] = useState(false);
  const [notif, setNotif] = useState<{
    title: string;
    body: string;
    category: string;
    version: string;
  } | null>(null);

  useEffect(() => {
    // Wait until AdminLayout has finished fetching store data before checking.
    // This ensures storeCreatedAt is the real resolved value, not the null default.
    if (!storeLoaded) return;

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('push_notification_title, push_notification_body, push_notification_category, push_notification_version, push_notification_active, push_notification_sent_at')
          .eq('id', SETTINGS_ID)
          .single();

        if (error || !data) return;
        if (!data.push_notification_active) return;
        if (!data.push_notification_version || !data.push_notification_title || !data.push_notification_body) return;

        // New store filter: skip if notification was sent before the store was created
        if (storeCreatedAt && data.push_notification_sent_at) {
          const sentAt = new Date(data.push_notification_sent_at).getTime();
          const createdAt = new Date(storeCreatedAt).getTime();
          if (sentAt < createdAt) return;
        }

        // Check if already seen
        const seenKey = 'dd_notif_seen_' + data.push_notification_version;
        if (localStorage.getItem(seenKey)) return;

        setNotif({
          title: data.push_notification_title,
          body: data.push_notification_body,
          category: data.push_notification_category || 'Feature',
          version: data.push_notification_version,
        });
        setVisible(true);
      } catch (err) {
        console.error('[PushNotificationCard] Error:', err);
      }
    };

    check();
  }, [storeLoaded, storeCreatedAt]);

  const dismiss = () => {
    if (notif) {
      localStorage.setItem('dd_notif_seen_' + notif.version, '1');
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && notif && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        />
      )}
      {visible && notif && (
        <motion.div
          key="card"
          className="fixed inset-0 z-[201] flex items-center justify-center px-4 pointer-events-none"
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 space-y-4 pointer-events-auto">
            {/* Top row */}
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={CATEGORY_COLORS[notif.category] || CATEGORY_COLORS['Feature']}
              >
                {notif.category}
              </Badge>
              <button
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What's New</p>
              <h3 className="font-bold text-lg leading-tight">{notif.title}</h3>
              <div className="mt-2 space-y-1">{renderBody(notif.body)}</div>
            </div>

            {/* CTA */}
            <Button className="w-full" onClick={dismiss}>
              Got it!
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PushNotificationCard;
