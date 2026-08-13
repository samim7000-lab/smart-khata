export interface EMIScheduleDraft {
  installment_number: number;
  due_date: string;
  amount: number;
}

export interface EMIAccountSummary {
  totalFinanced: number;
  totalPaid: number;
  totalRemaining: number;
  paidCount: number;
  remainingCount: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  nextInstallmentNumber: number | null;
  status: 'active' | 'overdue' | 'completed';
}

/**
 * Calculates Financed Amount = Total Amount - Down Payment.
 * Enforces non-negative result.
 */
export function calculateFinancedAmount(totalAmount: number, downPayment: number): number {
  const total = Number(totalAmount) || 0;
  const down = Number(downPayment) || 0;
  if (down > total) return 0;
  return Math.max(total - down, 0);
}

/**
 * Calculates monthly installment amount = Financed Amount / Count.
 * Rounds to 2 decimal places cleanly.
 */
export function calculateInstallmentAmount(financedAmount: number, count: number): number {
  const financed = Number(financedAmount) || 0;
  const numCount = Number(count) || 0;
  if (numCount <= 0) return 0;
  return Math.round((financed / numCount) * 100) / 100;
}

/**
 * Safely adds months to a date string (YYYY-MM-DD), handling month-end bounds.
 * Example: 2026-01-31 + 1 month -> 2026-02-28.
 */
export function addMonthsSafe(startDateStr: string, monthsToAdd: number): string {
  const [yearStr, monthStr, dayStr] = startDateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-indexed in JS
  let day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const today = new Date();
    year = today.getFullYear();
    month = today.getMonth();
    day = today.getDate();
  }

  const targetMonth = month + monthsToAdd;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  // Last valid day of normalized month
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayOfTargetMonth);

  const finalDate = new Date(targetYear, normalizedMonth, safeDay);
  const y = finalDate.getFullYear();
  const m = String(finalDate.getMonth() + 1).padStart(2, '0');
  const d = String(finalDate.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/**
 * Generates exact monthly installment schedule array.
 */
export function generateInstallmentSchedule(
  startDateStr: string,
  count: number,
  financedAmount: number
): EMIScheduleDraft[] {
  const numCount = Math.max(Number(count) || 1, 1);
  const baseAmount = calculateInstallmentAmount(financedAmount, numCount);
  const schedule: EMIScheduleDraft[] = [];

  let accumulated = 0;

  for (let i = 1; i <= numCount; i++) {
    const due_date = addMonthsSafe(startDateStr, i - 1);
    let amount = baseAmount;

    // Adjust last installment to prevent penny rounding drift
    if (i === numCount) {
      amount = Math.round((financedAmount - accumulated) * 100) / 100;
    } else {
      accumulated += amount;
    }

    schedule.push({
      installment_number: i,
      due_date,
      amount: Math.max(amount, 0),
    });
  }

  return schedule;
}

/**
 * Single source of truth calculation for EMI account status & summary metrics.
 */
export function calculateAccountSummary(
  installments: Array<{
    amount: number;
    paid_amount: number;
    due_date: string;
    status: string;
    installment_number: number;
  }>
): EMIAccountSummary {
  const todayStr = new Date().toISOString().split('T')[0];

  let totalFinanced = 0;
  let totalPaid = 0;
  let paidCount = 0;
  let remainingCount = 0;
  let hasOverdue = false;

  let nextDueInst: { amount: number; due_date: string; installment_number: number } | null = null;

  const sorted = [...installments].sort((a, b) => a.installment_number - b.installment_number);

  sorted.forEach((inst) => {
    const amt = Number(inst.amount) || 0;
    const paid = Number(inst.paid_amount) || 0;
    totalFinanced += amt;
    totalPaid += paid;

    if (inst.status === 'paid' || paid >= amt) {
      paidCount++;
    } else {
      remainingCount++;
      if (inst.due_date < todayStr || inst.status === 'overdue') {
        hasOverdue = true;
      }
      if (!nextDueInst) {
        nextDueInst = {
          amount: amt - paid,
          due_date: inst.due_date,
          installment_number: inst.installment_number,
        };
      }
    }
  });

  const totalRemaining = Math.max(totalFinanced - totalPaid, 0);

  let status: EMIAccountSummary['status'] = 'active';
  if (totalRemaining <= 0 || (installments.length > 0 && paidCount === installments.length)) {
    status = 'completed';
  } else if (hasOverdue) {
    status = 'overdue';
  }

  const nextInst = nextDueInst as { amount: number; due_date: string; installment_number: number } | null;

  return {
    totalFinanced,
    totalPaid,
    totalRemaining,
    paidCount,
    remainingCount,
    nextDueDate: nextInst ? nextInst.due_date : null,
    nextDueAmount: nextInst ? nextInst.amount : 0,
    nextInstallmentNumber: nextInst ? nextInst.installment_number : null,
    status,
  };
}
