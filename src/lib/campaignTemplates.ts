import { Language } from '../types';

export type CampaignGoalCategory =
  | 'new_product'
  | 'discount'
  | 'festival'
  | 'bring_back'
  | 'loyal'
  | 'old_stock';

export interface CategoryTemplateInfo {
  id: CampaignGoalCategory;
  title: string;
  bnTitle: string;
  hiTitle: string;
  icon: string;
  desc: string;
  bnDesc: string;
}

export const CAMPAIGN_CATEGORIES: CategoryTemplateInfo[] = [
  {
    id: 'new_product',
    title: 'New Product',
    bnTitle: 'নতুন পণ্য ঘোষণা',
    hiTitle: 'नए उत्पाद',
    icon: '📦',
    desc: 'Announce new arrivals & latest collection to your customers',
    bnDesc: 'দোকানের নতুন পণ্য বা কালেকশনের খবর জানান',
  },
  {
    id: 'discount',
    title: 'Discount / Sale',
    bnTitle: 'ছাড় / বিশেষ ডিসকাউন্ট',
    hiTitle: 'डिस्काउंट / सेल',
    icon: '🏷️',
    desc: 'Promote special discounts, sales, or promotional prices',
    bnDesc: 'বিশেষ ছাড় বা সেল অফার প্রচার করুন',
  },
  {
    id: 'festival',
    title: 'Festival Offer',
    bnTitle: 'বিশেষ সিজনাল অফার',
    hiTitle: 'मौसमी (सीज़नल) ऑफर',
    icon: '🎉',
    desc: 'Promote a seasonal or festival-related special offer',
    bnDesc: 'উৎসব ও সিজনভিত্তিক বিশেষ ডিল ও অফার প্রচার করুন',
  },
  {
    id: 'bring_back',
    title: 'Bring Back Inactive',
    bnTitle: 'পুরাতন কাস্টমার ফেরত আনুন',
    hiTitle: 'पुराने ग्राहक वापसी',
    icon: '🔄',
    desc: 'Re-engage customers who have not visited or bought recently',
    bnDesc: 'অনেকদিন কেনাকাটা না করা কাস্টমারদের পুনরায় আমন্ত্রণ জানান',
  },
  {
    id: 'loyal',
    title: 'Loyal Customer Offer',
    bnTitle: 'নিয়মিত কাস্টমার বিশেষ অফার',
    hiTitle: 'वफादार ग्राहक ऑफर',
    icon: '⭐',
    desc: 'Reward your valued VIP repeat customers with exclusive deals',
    bnDesc: 'নিয়মিত ও বিশ্বস্ত কাস্টমারদের জন্য এক্সক্লুসিভ অফার পাঠাও',
  },
  {
    id: 'old_stock',
    title: 'Stock Clearance',
    bnTitle: 'স্টক ক্লিয়ারেন্স সেল',
    hiTitle: 'स्टॉक क्लीयरेंस सेल',
    icon: '🧹',
    desc: 'Clear remaining inventory quickly with special clearance pricing',
    bnDesc: 'স্টক শেষ করার জন্য বিশেষ ছাড়ের ক্লিয়ারেন্স সেল',
  },
];

/**
 * Get category-specific WhatsApp campaign draft text based on category & language
 * STRICT RULE: Completely religion-neutral (No religious greetings/references)
 */
export function getCampaignDraft(category: CampaignGoalCategory, lang: Language): string {
  switch (category) {
    case 'new_product':
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, আমাদের দোকানে নতুন কিছু পণ্য এসেছে! আমাদের নতুন কালেকশন দেখে আপনার পছন্দের পণ্যটি খুঁজে নিন। বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।';
      }
      if (lang === 'hi') {
        return 'नमस्ते {{customer_name}}, हमारी दुकान में नए उत्पाद आ गए हैं! हमारे नवीनतम कलेक्शन को देखें और अपनी पसंद का सामान चुनें। अधिक जानकारी के लिए हमसे संपर्क करें।';
      }
      return "Hi {{customer_name}}, we've just added some new products to our store! Take a look at our latest arrivals and discover something you may like. Contact us for more details.";

    case 'discount':
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, আপনার জন্য আমাদের বিশেষ ডিসকাউন্ট অফার চলছে! নির্বাচিত পণ্যে দারুণ সাশ্রয়ের সুযোগ রয়েছে। বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।';
      }
      if (lang === 'hi') {
        return 'नमस्ते {{customer_name}}, आपके लिए हमारा विशेष डिस्काउंट ऑफर चल रहा है! चुनिंदा उत्पादों पर शानदार बचत का लाभ उठाएं। अधिक जानकारी के लिए संपर्क करें।';
      }
      return 'Hi {{customer_name}}, we have a special discount offer for you! Shop now and enjoy great savings on selected products. Contact us to know more.';

    case 'festival':
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, আমাদের বিশেষ সিজনাল অফার এখন চলছে! সীমিত সময়ের জন্য আকর্ষণীয় ডিল উপভোগ করুন। বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।';
      }
      if (lang === 'hi') {
        return 'नमस्ते {{customer_name}}, हमारा विशेष मौसमी (सीज़नल) ऑफर अब शुरू हो गया है! सीमित समय के लिए आकर्षक डील्स का आनंद लें। अधिक जानकारी के लिए संपर्क करें।';
      }
      return 'Hi {{customer_name}}, our special seasonal offer is now live! Enjoy exciting deals for a limited time. Visit our store or contact us to know more.';

    case 'bring_back':
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, অনেকদিন ধরে আপনার সাথে দেখা নেই! আপনাকে আবার আমাদের দোকানে পেলে আমরা আনন্দিত হব। নতুন পণ্য ও বিশেষ অফার দেখতে একবার আসুন।';
      }
      if (lang === 'hi') {
        return 'नमस्ते {{customer_name}}, आपसे मिले काफी समय हो गया है! हम आपकी वापसी पर बहुत खुश होंगे। हमारी दुकान पर आए नए प्रोडक्ट्स और खास ऑफर जरूर देखें।';
      }
      return "Hi {{customer_name}}, we haven't seen you in a while! We'd love to welcome you back. Check out what's new at our store and enjoy a special offer.";

    case 'loyal':
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, আমাদের একজন মূল্যবান গ্রাহক হিসেবে পাশে থাকার জন্য ধন্যবাদ! আপনার জন্য একটি বিশেষ অফার রয়েছে। বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।';
      }
      if (lang === 'hi') {
        return 'नमस्ते {{customer_name}}, हमारे एक पसंदीदा और खास ग्राहक होने के लिए धन्यवाद! आपके लिए एक विशेष ऑफर तैयार है। अधिक जानकारी के लिए संपर्क करें।';
      }
      return 'Hi {{customer_name}}, thank you for being one of our valued customers! We have a special offer reserved for you. Contact us to know more.';

    case 'old_stock':
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, আমাদের স্টক ক্লিয়ারেন্স সেল চলছে! স্টক শেষ হওয়ার আগে নির্বাচিত পণ্যগুলো বিশেষ দামে কিনে নিন। উপলব্ধ পণ্য ও বিস্তারিত জানতে যোগাযোগ করুন।';
      }
      if (lang === 'hi') {
        return 'नमस्ते {{customer_name}}, हमारी स्टॉक क्लीयरेंस सेल चालू है! स्टॉक खत्म होने से पहले चुनिंदा सामान विशेष दामों पर खरीदें। उपलब्ध उत्पादों की जानकारी के लिए संपर्क करें।';
      }
      return 'Hi {{customer_name}}, our stock clearance sale is on! Grab selected products at special prices while stocks last. Contact us for available items and details.';

    default:
      if (lang === 'bn') {
        return 'হ্যালো {{customer_name}}, {{store_name}} থেকে বিশেষ আপডেট! বিস্তারিত জানতে আমাদের সাথে যোগাযোগ করুন।';
      }
      return 'Hi {{customer_name}}, a special update from {{store_name}}! Contact us to know more.';
  }
}
