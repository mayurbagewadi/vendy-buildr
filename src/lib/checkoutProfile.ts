export type SavedCheckoutProfile = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  landmark: string;
  pincode: string;
  deliveryTime: "morning" | "evening" | "anytime";
};

const STORAGE_KEY = "vendy_checkout_profile_v1";

const readString = (value: unknown) => typeof value === "string" ? value.trim() : "";

const readDeliveryTime = (value: unknown): SavedCheckoutProfile["deliveryTime"] => {
  return value === "morning" || value === "evening" || value === "anytime"
    ? value
    : "anytime";
};

export const loadSavedCheckoutProfile = (): SavedCheckoutProfile | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawProfile = window.localStorage.getItem(STORAGE_KEY);
    if (!rawProfile) return null;

    const parsed = JSON.parse(rawProfile);
    if (!parsed || typeof parsed !== "object") return null;

    const profile: SavedCheckoutProfile = {
      fullName: readString(parsed.fullName),
      phone: readString(parsed.phone),
      email: readString(parsed.email),
      address: readString(parsed.address),
      landmark: readString(parsed.landmark),
      pincode: readString(parsed.pincode),
      deliveryTime: readDeliveryTime(parsed.deliveryTime),
    };

    return profile.fullName || profile.phone || profile.address || profile.pincode
      ? profile
      : null;
  } catch {
    return null;
  }
};

export const saveCheckoutProfile = (profile: SavedCheckoutProfile) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      fullName: profile.fullName.trim(),
      phone: profile.phone.trim(),
      email: profile.email.trim(),
      address: profile.address.trim(),
      landmark: profile.landmark.trim(),
      pincode: profile.pincode.trim(),
      deliveryTime: profile.deliveryTime,
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // Browser storage can be blocked; checkout must continue normally.
  }
};
