import { Shop } from '../types';

/**
 * Checks if a shop profile has all required fields completed.
 * Required fields: shop_name, owner_name, country, phone / whatsapp_number.
 */
export function isShopProfileComplete(shop: Partial<Shop> | null): boolean {
  if (!shop) return false;

  const hasShopName = !!(shop.shop_name && shop.shop_name.trim().length > 0);
  const hasOwnerName = !!(shop.owner_name && shop.owner_name.trim().length > 0);
  const hasCountry = !!(shop.country && shop.country.trim().length > 0);
  const rawPhone = (shop.whatsapp_number || shop.phone || '').trim();
  const hasPhone = rawPhone.length >= 6;

  return hasShopName && hasOwnerName && hasCountry && hasPhone;
}
