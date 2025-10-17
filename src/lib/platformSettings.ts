// Platform-wide settings for super admin

export interface PlatformSettings {
  senderEmail: string;
  senderName: string;
  platformName: string;
}

const PLATFORM_SETTINGS_KEY = 'platform_settings';

const defaultPlatformSettings: PlatformSettings = {
  senderEmail: 'onboarding@resend.dev',
  senderName: 'Super Admin',
  platformName: 'Vendy Platform',
};

// Get platform settings
export const getPlatformSettings = (): PlatformSettings => {
  const settings = sessionStorage.getItem(PLATFORM_SETTINGS_KEY);
  return settings ? JSON.parse(settings) : defaultPlatformSettings;
};

// Save platform settings
export const savePlatformSettings = (settings: PlatformSettings): void => {
  sessionStorage.setItem(PLATFORM_SETTINGS_KEY, JSON.stringify(settings));
};

// Get specific platform setting
export const getPlatformSetting = <K extends keyof PlatformSettings>(
  key: K
): PlatformSettings[K] => {
  const settings = getPlatformSettings();
  return settings[key];
};

// Update specific platform setting
export const updatePlatformSetting = <K extends keyof PlatformSettings>(
  key: K,
  value: PlatformSettings[K]
): void => {
  const settings = getPlatformSettings();
  settings[key] = value;
  savePlatformSettings(settings);
};
