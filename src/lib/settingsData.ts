// Shared settings utility for admin and customer sections

export interface StoreSettings {
  storeName: string;
  whatsappNumber: string;
  email?: string;
  address?: string;
  deliveryCharge: number;
  freeShippingThreshold: number;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

const SETTINGS_KEY = 'store_settings';

const defaultSettings: StoreSettings = {
  storeName: 'Vendy Store',
  whatsappNumber: '919876543210',
  email: 'contact@vendystore.com',
  address: '',
  deliveryCharge: 0,
  freeShippingThreshold: 500,
  taxRate: 0,
  currency: 'INR',
  currencySymbol: '₹',
  socialMedia: {
    facebook: '',
    instagram: '',
    twitter: '',
  },
};

// Initialize settings with defaults if none exist
export const initializeSettings = (): void => {
  const existingSettings = localStorage.getItem(SETTINGS_KEY);
  if (!existingSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
  }
};

// Get store settings
export const getSettings = (): StoreSettings => {
  const settings = localStorage.getItem(SETTINGS_KEY);
  return settings ? JSON.parse(settings) : defaultSettings;
};

// Save store settings
export const saveSettings = (settings: StoreSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// Get specific setting
export const getSetting = <K extends keyof StoreSettings>(key: K): StoreSettings[K] => {
  const settings = getSettings();
  return settings[key];
};

// Update specific setting
export const updateSetting = <K extends keyof StoreSettings>(
  key: K,
  value: StoreSettings[K]
): void => {
  const settings = getSettings();
  settings[key] = value;
  saveSettings(settings);
};
