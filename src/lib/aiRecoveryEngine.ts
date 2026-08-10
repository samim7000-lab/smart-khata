import { Customer, Language, Shop, Transaction } from '../types';
import { replaceMessageVariables } from './communicationEngine';
import { getCountryPricing, formatShopCurrency } from './countryPricing';

export interface AIRecoveryAnalysis {
  customer: Customer;
  score: number; // 0 to 100
  priorityTier: 'high' | 'medium' | 'low';
  outstandingBalance: number;
  oldestUnpaidDays: number;
  daysSinceLastPayment: number;
  txCount: number;
  reasons: string[];
  explanation: string;
  recommendedAction: string;
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
 * Calculate AI Payment Recovery Priority Score (0-100), Human-Readable Reasons & Cooldown
 * Note: Balances are calculated 100% from ledger DB records.
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

  // 3. Check Cooldown (7 days cooldown threshold)
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

  // 4. Compute Transparent AI Priority Score (0 - 100)
  // Amount weight (40%), Age weight (40%), Delay weight (20%)
  const amountScore = Math.min(40, (balance / 5000) * 40);
  const ageScore = Math.min(40, (oldestUnpaidDays / 30) * 40);
  const delayScore = Math.min(20, (daysSinceLastPayment / 20) * 20);

  const rawScore = Math.round(amountScore + ageScore + delayScore);
  const score = Math.min(99, Math.max(15, rawScore));

  // Determine Priority Tier
  const priorityTier: 'high' | 'medium' | 'low' =
    score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';

  // Format currency strictly by shop country/currency code
  const formattedBal = formatShopCurrency(balance, shop.country, shop.currency_code);

  // 5. Human-Readable Explanatory Reasons Array
  const reasons: string[] = [
    `• ${formattedBal} outstanding balance`,
    `• ${oldestUnpaidDays} days overdue`,
    `• ${custTxs.length} total ledger transactions`,
  ];

  if (daysSinceLastPayment < 999) {
    reasons.push(`• Last payment received ${daysSinceLastPayment} days ago`);
  } else {
    reasons.push(`• No payment recorded yet`);
  }

  // Generate Business Explanation based on Language
  let explanation = '';
  if (language === 'bn') {
    explanation = score >= 80
      ? `উচ্চ অগ্রাধিকার: ${formattedBal} বকেয়া টাকা ${oldestUnpaidDays} দিন ধরে অনাদায়ী রয়েছে।`
      : score >= 50
      ? `মাঝারি অগ্রাধিকার: ${formattedBal} বকেয়া পেন্ডিং রয়েছে।`
      : `সাধারণ বকেয়া ${formattedBal} স্বাভাবিক সময়সীমার মধ্যে রয়েছে।`;
  } else if (language === 'hi') {
    explanation = score >= 80
      ? `उच्च प्राथमिकता: ${formattedBal} का बकाया ${oldestUnpaidDays} दिनों से भुगतान नहीं हुआ है।`
      : score >= 50
      ? `मध्यम प्राथमिकता: ${formattedBal} का बकाया लंबित है।`
      : `सामान्य बकाया ${formattedBal} सामान्य समय सीमा में है।`;
  } else {
    explanation = score >= 80
      ? `High priority because ${formattedBal} has remained unpaid for ${oldestUnpaidDays} days.`
      : score >= 50
      ? `Medium priority due to pending ${formattedBal} with last payment ${daysSinceLastPayment === 999 ? 'none' : `${daysSinceLastPayment} days ago`}.`
      : `Low priority balance of ${formattedBal} within normal payment timeline.`;
  }

  // Action Recommendation based on Cooldown & Score
  let recommendedAction = '';
  if (cooldownActive) {
    recommendedAction = `Do Not Remind Yet (${cooldownDaysRemaining} days cooldown left)`;
  } else if (score >= 80) {
    recommendedAction = 'Immediate Payment Reminder Recommended';
  } else if (score >= 50) {
    recommendedAction = 'Follow-Up Reminder Recommended';
  } else {
    recommendedAction = 'Friendly Update Recommended';
  }

  // Respectful Reminder Message Template
  const rawTemplate =
    'Dear {{customer_name}},\n\nFriendly update from {{store_name}}. Your current pending balance is {{due_amount}} as of {{today}}.\n\nShop Address: {{shop_address}}\nInvoice Ref: {{invoice_ref}}\n\nThank you!';

  const suggestedMessage = replaceMessageVariables(rawTemplate, customer, shop);

  return {
    customer,
    score,
    priorityTier,
    outstandingBalance: balance,
    oldestUnpaidDays,
    daysSinceLastPayment,
    txCount: custTxs.length,
    reasons,
    explanation,
    recommendedAction,
    suggestedMessage,
    cooldownActive,
    cooldownDaysRemaining,
    lastRemindedAt: lastSentIso,
  };
}

/**
 * Generate Weekly AI Recovery Priorities ranked by score
 * Enforces Weekly Quota based on plan tier (Free: 3 preview, Pro: 25, Business: Unlimited)
 */
export function generateWeeklyRecoveryPriorities(
  customers: Customer[],
  transactions: Transaction[],
  shop: Shop,
  language: Language = 'en'
): {
  recommendations: AIRecoveryAnalysis[];
  weeklyQuota: number;
  totalDueCustomersCount: number;
  totalOutstandingAmount: number;
} {
  const countryPricing = getCountryPricing(shop.country);
  const planTier = shop.plan_tier || 'free';
  const weeklyQuota = planTier === 'free' ? 3 : planTier === 'pro' ? 25 : 9999;

  const dueCustomers = customers.filter((c) => (!c.shop_id || c.shop_id === shop.id) && (c.balance || 0) > 0);
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
