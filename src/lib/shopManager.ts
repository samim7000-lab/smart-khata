import { Shop, UserRole } from '../types';

const ACTIVE_SHOP_STORAGE_KEY = 'smart_khata_active_shop_id';

/**
 * Get active shop ID from LocalStorage with fallback to first available shop
 */
export const getActiveShopId = (shops: Shop[]): string | null => {
  if (!shops || shops.length === 0) return null;
  const storedId = localStorage.getItem(ACTIVE_SHOP_STORAGE_KEY);
  if (storedId && shops.some((s) => s.id === storedId)) {
    return storedId;
  }
  // Default to first shop (Primary Shop for single-shop users)
  return shops[0].id;
};

/**
 * Set active shop ID in LocalStorage
 */
export const setActiveShopId = (shopId: string): void => {
  localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, shopId);
};

/**
 * Get active shop object from shop array
 */
export const getActiveShop = (shops: Shop[]): Shop | null => {
  const activeId = getActiveShopId(shops);
  if (!activeId) return null;
  return shops.find((s) => s.id === activeId) || shops[0] || null;
};

/**
 * Resolve user role for the active shop.
 * For primary shop owners (default case), always returns 'owner'.
 */
export const getUserShopRole = (shop: Shop | null, userId?: string): UserRole => {
  if (!shop) return 'viewer';
  if (!userId || shop.owner_id === userId) return 'owner';
  return 'staff';
};
