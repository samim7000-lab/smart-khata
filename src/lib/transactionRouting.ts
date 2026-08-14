import { Customer, Shop, Transaction } from '../types';

export type PaymentType = 'full' | 'due' | 'emi';
export type RecoveryType = 'none' | 'regular_due' | 'emi';

export interface TransactionClassification {
  paymentType: PaymentType;
  recoveryType: RecoveryType;
  campaignEligible: boolean; // ALWAYS true for 100% of transactions
}

/**
 * Single Canonical Transaction Classifier
 * Enforces business rules across the application:
 * 1. Full Payment -> paymentType='full', recoveryType='none', campaignEligible=true
 * 2. Regular Due -> paymentType='due', recoveryType='regular_due', campaignEligible=true
 * 3. EMI -> paymentType='emi', recoveryType='emi', campaignEligible=true
 */
export function classifyTransaction(
  type: string,
  isEmi: boolean = false,
  balanceAfter: number = 0
): TransactionClassification {
  if (isEmi) {
    return {
      paymentType: 'emi',
      recoveryType: 'emi',
      campaignEligible: true,
    };
  }

  if (type === 'payment_received' || balanceAfter <= 0) {
    return {
      paymentType: 'full',
      recoveryType: 'none',
      campaignEligible: true,
    };
  }

  return {
    paymentType: 'due',
    recoveryType: 'regular_due',
    campaignEligible: true,
  };
}

/**
 * DEV Diagnostic Logging helper (Part 14)
 */
export function logTransactionRouting(params: {
  transactionId: string;
  customerId: string;
  shopId: string;
  paymentType: PaymentType;
  dueAmount: number;
  balance: number;
  recoveryType: RecoveryType;
  campaignSyncStarted?: boolean;
  campaignSyncSuccess?: boolean;
  recoverySyncSuccess?: boolean;
  emiSyncSuccess?: boolean | 'skipped';
}): void {
  console.log('[TX] ========================================');
  console.log(`[TX] transaction_id: ${params.transactionId}`);
  console.log(`[TX] customer_id: ${params.customerId}`);
  console.log(`[TX] shop_id: ${params.shopId}`);
  console.log(`[TX] payment_type: ${params.paymentType}`);
  console.log(`[TX] due_amount: ${params.dueAmount}`);
  console.log(`[TX] balance: ${params.balance}`);
  console.log(`[TX] recovery_type: ${params.recoveryType}`);
  console.log(`[TX] campaign_sync_started: ${params.campaignSyncStarted ?? true}`);
  console.log(`[TX] campaign_sync_success: ${params.campaignSyncSuccess ?? true}`);
  console.log(`[TX] recovery_sync_success: ${params.recoverySyncSuccess ?? true}`);
  console.log(`[TX] emi_sync_success: ${params.emiSyncSuccess ?? 'skipped'}`);
  console.log('[TX] ========================================');
}
