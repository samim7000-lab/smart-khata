import {
  normalizeWhatsAppPhone,
  validateCustomerPhone,
  getWhatsAppChatUrl,
  buildWhatsAppMessage,
  dispatchWhatsApp,
  generateVCard,
} from './whatsappService';

export {
  normalizeWhatsAppPhone,
  validateCustomerPhone,
  getWhatsAppChatUrl,
  buildWhatsAppMessage,
  dispatchWhatsApp,
  generateVCard,
};

/**
 * Backwards compatibility aliases for existing imports
 */
export const formatWhatsAppNumber = normalizeWhatsAppPhone;
export const getWhatsAppUrl = getWhatsAppChatUrl;
