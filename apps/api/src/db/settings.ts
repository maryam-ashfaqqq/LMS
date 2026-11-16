import type { RowDataPacket } from 'mysql2';
import { exec, query } from './pool';

export const settingDefaults = {
  site_name: 'Oakline',
  tagline: 'Courses taught with the care of a studio.',
  support_email: 'support@oakline.test',
  allow_instructor_registration: 'true',
  currency: 'USD',
} as const;

export type SettingKey = keyof typeof settingDefaults;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const settings: Record<SettingKey, string> = { ...settingDefaults };
  const rows = await query<RowDataPacket & { setting_key: string; setting_value: string }>(
    'SELECT setting_key, setting_value FROM platform_settings',
  );
  for (const row of rows) {
    if (row.setting_key in settings) {
      settings[row.setting_key as SettingKey] = row.setting_value;
    }
  }
  return settings;
}

export async function saveSettings(values: Record<SettingKey, string>) {
  for (const [key, value] of Object.entries(values)) {
    await exec(
      `INSERT INTO platform_settings (setting_key, setting_value)
       VALUES (:key, :value)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      { key, value },
    );
  }
  return getSettings();
}
