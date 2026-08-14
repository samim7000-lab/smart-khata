import { Customer, Language, Shop, Transaction } from '../types';
import { replaceMessageVariables } from './communicationEngine';
import { getCountryPricing, formatShopCurrency } from './countryPricing';

export interface AIRecoveryAnalysis {
  customer: Customer;
  score: number; // 0 to 100
  priorityTier: 'high' | 'medium' | 'low';
  priorityLabelBn: string; // 'আজই মনে করান' | 'শীঘ্রই মনে করান' | 'এখন দরকার নেই'
  priorityLabelEn: string; // 'Immediate Reminder' | 'Follow Up Soon' | 'No Rush'
  outstandingBalance: number;
  oldestUnpaidDays: number;
  daysSinceLastPayment: number;
  txCount: number;
  reasons: string[];
  explanation: string;
  recommendedAction: string;
  recommendedActionBn: string;
  suggestedMessage: string;
  cooldownActive: boolean;
  cooldownDaysRemaining: number;
  lastRemindedAt?: string | null;
}

const STORAGE_KEY_REMINDER_LOGS = 'smart_khata_ai_reminders_sent_log';

/**
 * Get stored last reminder timestamp for a customer
 */
export function getLastReminderTime(customerId: string): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDER_LOGS);
    if (!raw) return null;
    const logs: Record<string, string> = JSON.parse(raw);
    return logs[customerId] || null;
  } catch {
    return null;
  }
}

/**
 * Record a reminder dispatch for a customer to enforce 7-day cooldown
 */
export function recordReminderSent(customerId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDER_LOGS);
    const logs: Record<string, string> = raw ? JSON.parse(raw) : {};
    logs[customerId] = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_REMINDER_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.warn('[AI RECOVERY] Error logging reminder timestamp:', err);
  }
}

/**
 * Calculate Deterministic Recovery Priority Score (0-100), Explanations & Action Recommendations
 */
export function analyzeCustomerRecovery(
  customer: Customer,
  transactions: Transaction[],
  shop: Shop,
  language: Language = 'en'
): AIRecoveryAnalysis | null {
  const balance = customer.balance || 0;
  if (balance <= 0) return null; // No recovery needed for zero/settled balance

  const custTxs = transactions.filter((t) => t.customer_id === customer.id && !t.is_voided);
  const creditTxs = custTxs.filter((t) => t.type === 'credit_given');
  const paymentTxs = custTxs.filter((t) => t.type === 'payment_received');

  const now = new Date().getTime();

  // 1. Calculate Oldest Unpaid Credit Days
  let oldestUnpaidDays = 0;
  if (creditTxs.length > 0) {
    const oldestCreditTime = new Date(creditTxs[creditTxs.length - 1].created_at).getTime();
    oldestUnpaidDays = Math.max(1, Math.floor((now - oldestCreditTime) / (1000 * 60 * 60 * 24)));
  } else {
    oldestUnpaidDays = 7;
  }

  // 2. Calculate Days Since Last Payment Received
  let daysSinceLastPayment = 999;
  if (paymentTxs.length > 0) {
    const latestPaymentTime = new Date(paymentTxs[0].created_at).getTime();
    daysSinceLastPayment = Math.max(0, Math.floor((now - latestPaymentTime) / (1000 * 60 * 60 * 24)));
  }

  // 3. Check Cooldown (7 days threshold)
  const lastSentIso = getLastReminderTime(customer.id);
  let cooldownActive = false;
  let cooldownDaysRemaining = 0;

  if (lastSentIso) {
    const lastSentTime = new Date(lastSentIso).getTime();
    const daysSinceLastReminder = Math.floor((now - lastSentTime) / (1000 * 60 * 60 * 24));
    if (daysSinceLastReminder < 7) {
      cooldownActive = true;
      cooldownDaysRemaining = 7 - daysSinceLastReminder;
    }
  }

  // 4. Compute Transparent Deterministic Priority Score (0 - 100)
  // Formula: Amount weight (40%), Age weight (40%), Payment Delay weight (20%)
  const amountScore = Math.min(40, (balance / 5000) * 40);
  const ageScore = Math.min(40, (oldestUnpaidDays / 30) * 40);
  const delayScore = Math.min(20, (daysSinceLastPayment / 20) * 20);

  const rawScore = Math.round(amountScore + ageScore + delayScore);
  const score = Math.min(99, Math.max(15, rawScore));

  // Priority Tiers & Bengali Labels
  let priorityTier: 'high' | 'medium' | 'low' = 'low';
  let priorityLabelBn = 'এখন দরকার নেই';
  let priorityLabelEn = 'No Rush';

  if (score >= 75 || oldestUnpaidDays >= 10) {
    priorityTier = 'high';
    priorityLabelBn = '🔴 আজই মনে করান';
    priorityLabelEn = '🔴 Immediate Reminder';
  } else if (score >= 45 || oldestUnpaidDays >= 3) {
    priorityTier = 'medium';
    priorityLabelBn = '🟠 শীঘ্রই মনে করান';
    priorityLabelEn = '🟠 Follow Up Soon';
  } else {
    priorityTier = 'low';
    priorityLabelBn = '🟢 এখন দরকার নেই';
    priorityLabelEn = '🟢 No Rush';
  }

  // Format currency strictly by shop country/currency code
  const formattedBal = formatShopCurrency(balance, shop.country, shop.currency_code);

  // 5. Explanatory Reasons Array
  const reasons: string[] = [
    `• ${formattedBal} বাকি টাকা`,
    `• ${oldestUnpaidDays} দিন অনাদায়ী (Overdue)`,
    `• মোট ${custTxs.length}টি লেনেদেন হিসাব`,
  ];

  if (daysSinceLastPayment < 999) {
    reasons.push(`• সর্বশেষ জমা: ${daysSinceLastPayment} দিন আগে`);
  } else {
    reasons.push(`• পূর্বে কোনো পেমেন্ট জমা হয়নি`);
  }

  // Generate Business Explanation
  let explanation = '';
  if (language === 'bn') {
    explanation = `${formattedBal} বাকি এবং ${oldestUnpaidDays} দিন অনাদায়ী — ${
      priorityTier === 'high' ? 'আজ মনে করানো ভালো।' : 'শীঘ্রই তদারকি করুন।'
    }`;
  } else {
    explanation = `${formattedBal} balance unpaid for ${oldestUnpaidDays} days — ${
      priorityTier === 'high' ? 'Recommended to contact today.' : 'Follow up soon.'
    }`;
  }

  // Action Recommendation based on Cooldown & Score
  let recommendedAction = '';
  let recommendedActionBn = '';

  if (cooldownActive) {
    recommendedAction = `Wait (${cooldownDaysRemaining} days cooldown left)`;
    recommendedActionBn = `অপেক্ষা করুন (${cooldownDaysRemaining} দিন কুলডাউন বাকি)`;
  } else if (priorityTier === 'high') {
    recommendedAction = 'Send WhatsApp Reminder or Call';
    recommendedActionBn = 'আজই হোয়াটসঅ্যাপে রিমাইন্ডার পাঠান বা কল দিন';
  } else if (priorityTier === 'medium') {
    recommendedAction = 'Follow up with customer';
    recommendedActionBn = 'কাস্টমারের সাথে কথা বলুন';
  } else {
    recommendedAction = 'No immediate action required';
    recommendedActionBn = 'এখনই কোনো তাগাদা দেওয়ার দরকার নেই';
  }

  // Respectful Reminder Message Template
  let rawTemplate = '';
  if (language === 'bn') {
    rawTemplate =
      'আসসালামু আলাইকুম {{customer_name}},\n\n{{store_name}} থেকে বকেয়া পরিশোধের বিনীত অনুরোধ। {{today}} তারিখ পর্যন্ত আপনার মোট বাকি টাকার পরিমাণ {{due_amount}}।\n\nঅনুগৃহ করে সুবিধামতো পেমেন্ট করে দিন।\nদোকানের ঠিকানা: {{shop_address}}\n\nধন্যবাদ!';
  } else if (language === 'hi') {
    rawTemplate =
      'नमस्ते {{customer_name}},\n\n{{store_name}} से बकाया भुगतान का विनम्र निवेदन। {{today}} तक आपकी कुल बकाया राशि {{due_amount}} है।\n\nकृपया अपनी सुविधा अनुसार भुगतान करें।\nदुकान का पता: {{shop_address}}\n\nधन्यवाद!';
  } else {
    rawTemplate =
      'Dear {{customer_name}},\n\nFriendly reminder from {{store_name}}. Your current pending balance is {{due_amount}} as of {{today}}.\n\nShop Address: {{shop_address}}\nInvoice Ref: {{invoice_ref}}\n\nThank you!';
  }

  const suggestedMessage = replaceMessageVariables(rawTemplate, customer, shop);

  return {
    customer,
    score,
    priorityTier,
    priorityLabelBn,
    priorityLabelEn,
    outstandingBalance: balance,
    oldestUnpaidDays,
    daysSinceLastPayment,
    txCount: custTxs.length,
    reasons,
    explanation,
    recommendedAction,
    recommendedActionBn,
    suggestedMessage,
    cooldownActive,
    cooldownDaysRemaining,
    lastRemindedAt: lastSentIso,
  };
}

/**
 * Generate Recovery Priorities ranked by score
 */
export function generateWeeklyRecoveryPriorities(
  customers: Customer[],
  transactions: Transaction[],
  shop: Shop,
  language: Language = 'en',
  emiCustomerIds?: Set<string>
): {
  recommendations: AIRecoveryAnalysis[];
  weeklyQuota: number;
  totalDueCustomersCount: number;
  totalOutstandingAmount: number;
} {
  const countryPricing = getCountryPricing(shop.country);
  const planTier = shop.plan_tier || 'free';
  const weeklyQuota = planTier === 'free' ? 3 : planTier === 'pro' ? 25 : 9999;

  const dueCustomers = customers.filter((c) => {
    const isShopMatch = !c.shop_id || c.shop_id === shop.id;
    const hasBalance = (c.balance || 0) > 0;
    const isEmiCustomer = emiCustomerIds ? emiCustomerIds.has(c.id) : false;
    return isShopMatch && hasBalance && !isEmiCustomer;
  });

  const totalOutstandingAmount = dueCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);

  const analyses: AIRecoveryAnalysis[] = [];
  dueCustomers.forEach((cust) => {
    const analysis = analyzeCustomerRecovery(cust, transactions, shop, language);
    if (analysis) analyses.push(analysis);
  });

  // Rank by score descending
  analyses.sort((a, b) => b.score - a.score);

  // Limit list to weekly quota
  const recommendations = analyses.slice(0, Math.min(analyses.length, weeklyQuota));

  return {
    recommendations,
    weeklyQuota,
    totalDueCustomersCount: dueCustomers.length,
    totalOutstandingAmount,
  };
}
