import { Customer, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';

// Generate printable HTML PDF for single transaction receipt
export const printTransactionReceiptPDF = (
  tx: Transaction,
  customer: Customer,
  shop: Shop,
  language: 'en' | 'bn' | 'hi'
) => {
  const t = translations[language];
  const curr = t.currency_symbol;
  const isCredit = tx.type === 'credit_given';

  const dateStr = new Date(tx.created_at).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download or print PDF receipts.');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${customer.display_label} - Smart Khata</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', 'Hind Siliguri', 'Segoe UI', -apple-system, sans-serif;
            padding: 24px;
            color: #0f172a;
            background: #ffffff;
            max-width: 600px;
            margin: 0 auto;
            -webkit-font-smoothing: antialiased;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .shop-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e293b;
            margin: 0;
          }
          .shop-sub {
            font-size: 13px;
            color: #64748b;
            margin-top: 4px;
          }
          .badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 999px;
            font-weight: 800;
            font-size: 14px;
            text-transform: uppercase;
            margin: 12px 0;
          }
          .badge-credit {
            background-color: #fee2e2;
            color: #991b1b;
          }
          .badge-payment {
            background-color: #dcfce7;
            color: #166534;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .info-table td {
            padding: 8px 0;
            font-size: 14px;
            border-bottom: 1px solid #f1f5f9;
          }
          .info-label {
            color: #64748b;
            font-weight: 600;
          }
          .info-val {
            text-align: right;
            font-weight: 700;
            color: #0f172a;
          }
          .amount-box {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            margin: 20px 0;
          }
          .amount-title {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
          }
          .amount-val {
            font-size: 32px;
            font-weight: 900;
            margin-top: 4px;
          }
          .amount-credit { color: #dc2626; }
          .amount-payment { color: #16a34a; }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 16px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="shop-title">${shop.shop_name}</h1>
          <div class="shop-sub">${shop.owner_name} • ${shop.phone || ''}</div>
          ${(shop.full_address || shop.city || shop.state) ? `<div class="shop-sub">📍 ${[shop.full_address, shop.city, shop.state].filter(Boolean).join(', ')}</div>` : ''}
          ${shop.gst_number ? `<div class="shop-sub">GSTIN: ${shop.gst_number}</div>` : ''}
        </div>

        <div style="text-align: center;">
          <div class="badge ${isCredit ? 'badge-credit' : 'badge-payment'}">
            ${isCredit ? t.credit_given : t.payment_received}
          </div>
        </div>

        <div class="amount-box">
          <div class="amount-title">${t.amount}</div>
          <div class="amount-val ${isCredit ? 'amount-credit' : 'amount-payment'}">
            ${curr} ${Number(tx.amount).toLocaleString()}
          </div>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">${t.receipt_customer}:</td>
            <td class="info-val">${customer.display_label} (${customer.phone_number})</td>
          </tr>
          <tr>
            <td class="info-label">${t.date}:</td>
            <td class="info-val">${dateStr}</td>
          </tr>
          <tr>
            <td class="info-label">${t.tx_id}:</td>
            <td class="info-val">#${tx.id.slice(-8)}</td>
          </tr>
          ${tx.note ? `
          <tr>
            <td class="info-label">${t.note_optional}:</td>
            <td class="info-val">${tx.note}</td>
          </tr>
          ` : ''}
          <tr>
            <td class="info-label">${t.due_amount}:</td>
            <td class="info-val" style="color: ${(customer.balance || 0) > 0 ? '#dc2626' : '#16a34a'}; font-size: 16px;">
              ${curr} ${Math.abs(customer.balance || 0).toLocaleString()}
            </td>
          </tr>
        </table>

        <div class="footer">
          <p>${t.receipt_thank_you}</p>
          <p>Powered by Smart Khata • ${t.tagline}</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// Generate printable HTML PDF for full customer account statement
export const printCustomerStatementPDF = (
  customer: Customer,
  transactions: Transaction[],
  shop: Shop,
  language: 'en' | 'bn' | 'hi'
) => {
  const t = translations[language];
  const curr = t.currency_symbol;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download or print PDF statements.');
    return;
  }

  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let runningBal = 0;
  const rowsHtml = sortedTxs
    .map((tx) => {
      const isCredit = tx.type === 'credit_given';
      if (!tx.is_voided) {
        runningBal += isCredit ? Number(tx.amount) : -Number(tx.amount);
      }

      const dateStr = new Date(tx.created_at).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return `
      <tr style="${tx.is_voided ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${dateStr}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${tx.note || (isCredit ? t.credit_given : t.payment_received)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #dc2626; font-weight: 700;">
          ${isCredit ? curr + ' ' + Number(tx.amount).toLocaleString() : '-'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; color: #16a34a; font-weight: 700;">
          ${!isCredit ? curr + ' ' + Number(tx.amount).toLocaleString() : '-'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 800;">
          ${curr} ${runningBal.toLocaleString()}
        </td>
      </tr>
    `;
    })
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Account Statement - ${customer.display_label} - Smart Khata</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', 'Hind Siliguri', 'Segoe UI', -apple-system, sans-serif;
            padding: 24px;
            color: #0f172a;
            background: #ffffff;
            max-width: 800px;
            margin: 0 auto;
            -webkit-font-smoothing: antialiased;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #334155;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .shop-title {
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
            margin: 0;
          }
          .shop-sub {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
          }
          .statement-title {
            font-size: 18px;
            font-weight: 800;
            color: #2563eb;
            text-align: right;
          }
          .cust-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
          }
          .tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          .tx-table th {
            background: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 10px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
          }
          .total-box {
            background: #0f172a;
            color: #ffffff;
            border-radius: 12px;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="shop-title">${shop.shop_name}</div>
            <div class="shop-sub">${shop.owner_name} • ${shop.phone || ''}</div>
            ${shop.full_address ? `<div class="shop-sub">${shop.full_address}</div>` : ''}
            ${shop.gst_number ? `<div class="shop-sub">GSTIN: ${shop.gst_number}</div>` : ''}
          </div>
          <div>
            <div class="statement-title">CUSTOMER STATEMENT</div>
            <div class="shop-sub" style="text-align: right;">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="cust-card">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Customer Details</div>
            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${customer.display_label}</div>
            <div style="font-size: 13px; color: #64748b;">${customer.phone_number}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Net Outstanding Balance</div>
            <div style="font-size: 22px; font-weight: 900; color: ${(customer.balance || 0) > 0 ? '#dc2626' : '#16a34a'}; margin-top: 2px;">
              ${curr} ${Math.abs(customer.balance || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <table class="tx-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Note</th>
              <th style="text-align: right;">Credit (+Owed)</th>
              <th style="text-align: right;">Payment (-Paid)</th>
              <th style="text-align: right;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #94a3b8;">No transaction history found.</td></tr>'}
          </tbody>
        </table>

        <div class="total-box">
          <div style="font-weight: 700; font-size: 14px;">FINAL OUTSTANDING DUE</div>
          <div style="font-size: 24px; font-weight: 900; color: #f87171;">
            ${curr} ${Math.abs(customer.balance || 0).toLocaleString()}
          </div>
        </div>

        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>Thank you for your business!</p>
          <p>Generated by Smart Khata Digital Udhar Ledger</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// Generate printable HTML PDF for Monthly Business Summary Report
export const printMonthlyBusinessReportPDF = (
  shop: Shop,
  customers: Customer[],
  transactions: Transaction[],
  language: 'en' | 'bn' | 'hi'
) => {
  const t = translations[language];
  const curr = t.currency_symbol;

  const totalOwed = customers.reduce((acc, c) => acc + ((c.balance || 0) > 0 ? (c.balance || 0) : 0), 0);
  const totalCollected = transactions
    .filter((tx) => tx.type === 'payment_received' && !tx.is_voided)
    .reduce((acc, tx) => acc + Number(tx.amount), 0);
  const totalCreditGiven = transactions
    .filter((tx) => tx.type === 'credit_given' && !tx.is_voided)
    .reduce((acc, tx) => acc + Number(tx.amount), 0);
  const recoveryRate = totalCreditGiven > 0 ? Math.min(100, Math.round((totalCollected / totalCreditGiven) * 100)) : 100;

  const topDueCusts = [...customers]
    .filter((c) => (c.balance || 0) > 0)
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .slice(0, 10);

  const topRowsHtml = topDueCusts
    .map(
      (c) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700;">${c.display_label}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">${c.phone_number}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 900; color: #dc2626;">
          ${curr} ${(c.balance || 0).toLocaleString()}
        </td>
      </tr>
    `
    )
    .join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download or print PDF business reports.');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Business Report - ${shop.shop_name} - Smart Khata</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', 'Hind Siliguri', 'Segoe UI', -apple-system, sans-serif;
            padding: 24px;
            color: #0f172a;
            background: #ffffff;
            max-width: 800px;
            margin: 0 auto;
            -webkit-font-smoothing: antialiased;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .shop-title {
            font-size: 24px;
            font-weight: 900;
            color: #0f172a;
            margin: 0;
          }
          .shop-sub {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
          }
          .grid-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }
          .stat-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            background: #f8fafc;
          }
          .stat-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
          }
          .stat-val {
            font-size: 22px;
            font-weight: 900;
            margin-top: 4px;
          }
          .tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          .tx-table th {
            background: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 10px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="shop-title">${shop.shop_name}</div>
            <div class="shop-sub">${shop.owner_name} • ${shop.phone || ''}</div>
            ${shop.full_address ? `<div class="shop-sub">${shop.full_address}</div>` : ''}
            ${shop.gst_number ? `<div class="shop-sub">GSTIN: ${shop.gst_number}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 900; color: #2563eb;">FINANCIAL SUMMARY REPORT</div>
            <div class="shop-sub">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="grid-stats">
          <div class="stat-card" style="border-color: #fecaca; background: #fff5f5;">
            <div class="stat-title" style="color: #991b1b;">Total Owed to You</div>
            <div class="stat-val" style="color: #dc2626;">${curr} ${totalOwed.toLocaleString()}</div>
          </div>

          <div class="stat-card" style="border-color: #bbf7d0; background: #f0fdf4;">
            <div class="stat-title" style="color: #166534;">Total Collected</div>
            <div class="stat-val" style="color: #16a34a;">${curr} ${totalCollected.toLocaleString()}</div>
          </div>

          <div class="stat-card" style="border-color: #bfdbfe; background: #eff6ff;">
            <div class="stat-title" style="color: #1e40af;">Recovery Efficiency</div>
            <div class="stat-val" style="color: #2563eb;">${recoveryRate}%</div>
          </div>
        </div>

        <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 12px;">
          Top Customers with Outstanding Dues (${topDueCusts.length})
        </h3>

        <table class="tx-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone Number</th>
              <th style="text-align: right;">Outstanding Balance</th>
            </tr>
          </thead>
          <tbody>
            ${topRowsHtml || '<tr><td colspan="3" style="text-align: center; padding: 16px; color: #94a3b8;">All accounts settled!</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          <p>Smart Khata Digital Udhar Ledger • Confidential Business Statement</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
