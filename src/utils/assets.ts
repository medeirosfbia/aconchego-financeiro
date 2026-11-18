import userProfileAvatar from '../assets/images/user_profile_avatar_1791335301763.jpg';
import goalVacationBeach from '../assets/images/goal_vacation_beach_1791335320745.jpg';
import goalEmergencyReserve from '../assets/images/goal_emergency_reserve_1791335328368.jpg';
import receiptSupermarketSample from '../assets/images/receipt_supermarket_sample_1791335311360.jpg';

export const AVATAR_DEFAULT_URL = userProfileAvatar;
export const GOAL_BEACH_URL = goalVacationBeach;
export const GOAL_RESERVE_URL = goalEmergencyReserve;
export const RECEIPT_SAMPLE_URL = receiptSupermarketSample;

const LEGACY_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/user_profile_avatar_1791335301763.jpg': userProfileAvatar,
  '/src/assets/images/goal_vacation_beach_1791335320745.jpg': goalVacationBeach,
  '/src/assets/images/goal_emergency_reserve_1791335328368.jpg': goalEmergencyReserve,
  '/src/assets/images/receipt_supermarket_sample_1791335311360.jpg': receiptSupermarketSample,
};

/**
 * Converte caminhos legados de desenvolvimento (`/src/assets/images/...`) para as URLs
 * empacotadas pelo Vite em produção, preservando URLs externas, blob URLs e data URLs.
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return LEGACY_ASSET_MAP[trimmed] || trimmed;
}
