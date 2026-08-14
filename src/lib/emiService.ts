import { supabase } from './supabase';
import { Customer } from '../types';
import { generateInstallmentSchedule, calculateAccountSummary } from './emiCalculations';

export interface CreateEMIPayload {
  shop_id: string;
  customer_id: string;
  transaction_id?: string;
  product_name: string;
  total_amount: number;
  down_payment: number;
  financed_amount: number;
  installment_count: number;
  installment_amount: number;
  start_date: string;
  notes?: string;
}

export interface EMIAccountDB {
  id: string;
  shop_id: string;
  customer_id: string;
  transaction_id?: string;
  product_name: string;
  total_amount: number;
  down_payment: number;
  financed_amount: number;
  installment_count: number;
  installment_amount: number;
  start_date: string;
  status: 'active' | 'completed' | 'overdue' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;

  // Joined/Enriched Data
  customer?: Customer;
  installments?: EMIInstallmentDB[];
}

export interface EMIInstallmentDB {
  id: string;
  emi_account_id: string;
  shop_id: string;
  customer_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: 'pending' | 'due_today' | 'overdue' | 'paid' | 'partially_paid';
  paid_at?: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;

  // Enriched Data
  customer?: Customer;
  product_name?: string;
}

import { assertValidUuid } from './uuidGuard';

export class EMIService {
  /**
   * Creates an EMI Account and generates all installment schedule rows in Supabase.
   */
  static async createEMIAccount(payload: CreateEMIPayload): Promise<{ success: boolean; accountId?: string; error?: string }> {
    // 1. Validation Checks
    if (!payload.shop_id) return { success: false, error: 'Shop ID is required' };
    if (!payload.customer_id) return { success: false, error: 'Customer ID is required' };
    if (!payload.product_name || payload.product_name.trim() === '') {
      return { success: false, error: 'Product name is required' };
    }
    if (payload.total_amount <= 0) return { success: false, error: 'Total amount must be greater than zero' };
    if (payload.down_payment < 0) return { success: false, error: 'Down payment cannot be negative' };
    if (payload.down_payment > payload.total_amount) {
      return { success: false, error: 'Down payment cannot exceed total amount' };
    }
    if (payload.installment_count <= 0) return { success: false, error: 'Installment count must be at least 1' };

    // 1b. Strict PostgreSQL UUID Pre-flight Guard (Blocks temp-* IDs)
    assertValidUuid(payload.shop_id, 'shop_id');
    assertValidUuid(payload.customer_id, 'customer_id');
    if (payload.transaction_id) {
      assertValidUuid(payload.transaction_id, 'transaction_id');
    }

    const financedAmount = Math.max(payload.total_amount - payload.down_payment, 0);

    if (!supabase) {
      console.warn('Supabase client not initialized in mock mode');
      return { success: true, accountId: `mock-emi-${Date.now()}` };
    }

    try {
      // 2. Insert into emi_accounts
      const { data: account, error: accountErr } = await supabase
        .from('emi_accounts')
        .insert({
          shop_id: payload.shop_id,
          customer_id: payload.customer_id,
          transaction_id: payload.transaction_id || null,
          product_name: payload.product_name.trim(),
          total_amount: payload.total_amount,
          down_payment: payload.down_payment,
          financed_amount: financedAmount,
          installment_count: payload.installment_count,
          installment_amount: payload.installment_amount,
          start_date: payload.start_date,
          status: 'active',
          notes: payload.notes || '',
        })
        .select()
        .single();

      if (accountErr || !account) {
        console.error('Failed to create EMI Account:', accountErr);
        return { success: false, error: accountErr?.message || 'Database insert failed' };
      }

      // 3. Generate Installment Schedule Rows
      const scheduleDrafts = generateInstallmentSchedule(payload.start_date, payload.installment_count, financedAmount);
      const todayStr = new Date().toISOString().split('T')[0];

      const installmentRows = scheduleDrafts.map((draft) => {
        let initialStatus: 'pending' | 'due_today' | 'overdue' = 'pending';
        if (draft.due_date === todayStr) {
          initialStatus = 'due_today';
        } else if (draft.due_date < todayStr) {
          initialStatus = 'overdue';
        }

        return {
          emi_account_id: account.id,
          shop_id: payload.shop_id,
          customer_id: payload.customer_id,
          installment_number: draft.installment_number,
          due_date: draft.due_date,
          amount: draft.amount,
          paid_amount: 0,
          status: initialStatus,
        };
      });

      const { error: instErr } = await supabase
        .from('emi_installments')
        .insert(installmentRows);

      if (instErr) {
        console.error('Failed to create EMI Installment Rows:', instErr);
        return { success: false, error: instErr.message };
      }

      return { success: true, accountId: account.id };
    } catch (err: any) {
      console.error('EMIService createEMIAccount exception:', err);
      return { success: false, error: err.message || 'Unexpected network error' };
    }
  }

  /**
   * Fetches EMI Accounts for a shop with their installments and customer details.
   */
  static async getEMIAccounts(shopId: string, customers: Customer[] = []): Promise<EMIAccountDB[]> {
    if (!shopId || !supabase) return [];

    try {
      const { data: accounts, error: accErr } = await supabase
        .from('emi_accounts')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (accErr || !accounts) return [];

      const { data: installments, error: instErr } = await supabase
        .from('emi_installments')
        .select('*')
        .eq('shop_id', shopId)
        .order('installment_number', { ascending: true });

      const customerMap = new Map(customers.map((c) => [c.id, c]));
      const instMap = new Map<string, EMIInstallmentDB[]>();

      if (installments) {
        installments.forEach((inst) => {
          const list = instMap.get(inst.emi_account_id) || [];
          list.push(inst as EMIInstallmentDB);
          instMap.set(inst.emi_account_id, list);
        });
      }

      return accounts.map((acc) => {
        const accInsts = instMap.get(acc.id) || [];
        const summary = calculateAccountSummary(accInsts);

        return {
          ...acc,
          status: summary.status,
          customer: customerMap.get(acc.customer_id),
          installments: accInsts,
        };
      });
    } catch (err) {
      console.error('EMIService getEMIAccounts exception:', err);
      return [];
    }
  }

  /**
   * Marks payment for an EMI installment (Full or Partial).
   */
  static async markInstallmentPayment(
    installment: EMIInstallmentDB,
    paymentAmount: number,
    transactionId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!installment || !installment.id) return { success: false, error: 'Invalid installment' };
    if (paymentAmount <= 0) return { success: false, error: 'Payment amount must be greater than zero' };

    const currentPaid = Number(installment.paid_amount) || 0;
    const totalDue = Number(installment.amount) || 0;
    const newPaidAmount = Math.min(currentPaid + paymentAmount, totalDue);

    if (currentPaid >= totalDue) {
      return { success: false, error: 'This installment is already fully paid.' };
    }

    const isFullyPaid = newPaidAmount >= totalDue;
    const newStatus: 'paid' | 'partially_paid' = isFullyPaid ? 'paid' : 'partially_paid';
    const nowIso = new Date().toISOString();

    if (!supabase) {
      return { success: true };
    }

    try {
      // 1. Update Installment Row
      const { error: updateErr } = await supabase
        .from('emi_installments')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_at: isFullyPaid ? nowIso : installment.paid_at || nowIso,
          transaction_id: transactionId || installment.transaction_id || null,
          updated_at: nowIso,
        })
        .eq('id', installment.id)
        .eq('shop_id', installment.shop_id);

      if (updateErr) {
        console.error('Failed to update installment payment:', updateErr);
        return { success: false, error: updateErr.message };
      }

      // 2. Re-check parent EMI Account status
      const { data: allInsts } = await supabase
        .from('emi_installments')
        .select('*')
        .eq('emi_account_id', installment.emi_account_id);

      if (allInsts) {
        const summary = calculateAccountSummary(allInsts);
        await supabase
          .from('emi_accounts')
          .update({
            status: summary.status,
            updated_at: nowIso,
          })
          .eq('id', installment.emi_account_id)
          .eq('shop_id', installment.shop_id);
      }

      return { success: true };
    } catch (err: any) {
      console.error('EMIService markInstallmentPayment exception:', err);
      return { success: false, error: err.message || 'Payment operation failed' };
    }
  }
}
