import { supabase } from "@/integrations/supabase/client";

export type BrowserPushStatus =
  | "unsupported"
  | "not_enabled"
  | "enabled"
  | "blocked";

const SERVICE_WORKER_URL = "/browser-push-sw.js";
const FUNCTION_NAME = "send-browser-push";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const getBrowserPushStatus = async (): Promise<BrowserPushStatus> => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "denied") return "blocked";

  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "enabled" : "not_enabled";
};

const getPublicKey = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action: "get_public_key" },
  });

  if (error) throw error;
  if (!data?.publicKey) throw new Error("Browser push public key is not configured.");
  return data.publicKey;
};

export const enableBrowserPush = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Browser notifications are not supported on this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") throw new Error("Browser notifications are blocked. Enable them from browser settings.");
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const publicKey = await getPublicKey();
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: {
      action: "upsert_subscription",
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    },
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Failed to enable browser notifications.");
  return data;
};

export const disableBrowserPush = async () => {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        action: "remove_subscription",
        endpoint: subscription.endpoint,
      },
    });
    await subscription.unsubscribe();
  }
};

export const sendTestBrowserPush = async () => {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action: "send_test" },
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Failed to send test notification.");
  return data;
};
