import { Customer, Shop, Transaction } from '../types';
import { translations } from '../i18n/translations';
import { formatShopCurrency } from './countryPricing';
import { unpackReceiptNote, calculatePreviousBalance } from './receiptUtils';

// Generate printable HTML PDF for single transaction receipt
export const printTransactionReceiptPDF = (
  tx: Transaction,
  customer: Customer,
  shop: Shop,
  language: 'en' | 'bn' | 'hi',
  allTransactions: Transaction[] = []
) => {
  const t = translations[language];
  const isCredit = tx.type === 'credit_given';
  const isVoid = tx.type === 'void_correction' || tx.is_voided;
  const typeLabel = isVoid ? t.void_correction : isCredit ? (language === 'bn' ? 'বাকি বিক্রি (Credit Given)' : 'Credit / Due Sale') : (language === 'bn' ? 'নগদ জমা (Payment Received)' : 'Payment Received');
  const fmt = (amt: number) => formatShopCurrency(amt, shop?.country, shop?.currency_code);

  const dateObj = new Date(tx.created_at);
  const dateFormatted = dateObj.toLocaleDateString(
    language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' }
  );
  const timeFormatted = dateObj.toLocaleTimeString(
    language === 'bn' ? 'bn-BD' : language === 'hi' ? 'hi-IN' : 'en-US',
    { hour: '2-digit', minute: '2-digit' }
  );

  const { noteText, details } = unpackReceiptNote(tx);

  // Deterministic previous balance & current balance
  const prevBalance = calculatePreviousBalance(tx, customer, allTransactions);
  const txAmt = Number(tx.amount) || 0;
  const currentBalance = isCredit ? prevBalance + txAmt : Math.max(0, prevBalance - txAmt);
  const isFullyPaid = currentBalance <= 0;

  // Line items
  const lineItems = details?.items && details.items.length > 0 ? details.items : [
    {
      id: 'default-item',
      name: noteText || (isCredit ? 'Credit Transaction Item' : 'Payment Received'),
      quantity: 1,
      unit_price: txAmt,
      total: txAmt,
    }
  ];

  const subtotal = details?.subtotal !== undefined ? details.subtotal : txAmt;
  const discountAmt = details?.discount_amount || 0;
  const taxableAmt = details?.taxable_amount !== undefined ? details.taxable_amount : Math.max(0, subtotal - discountAmt);
  const hasGst = shop.gst_enabled && tx.tax_amount && tx.tax_amount > 0;
  const gstPriceMode = details?.gst_price_mode || tx.gst_price_mode || 'exclusive';

  const receiptNumber = details?.receipt_number || `INV-${tx.id.replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`;
  const shopAddressStr = shop.full_address || [shop.city, shop.state, shop.postal_code].filter(Boolean).join(', ');
  const customerAddressStr = details?.customer_address || customer.address || customer.state || '';
  const customerGstinStr = details?.customer_gstin || customer.gstin || '';

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
        <title>Receipt ${receiptNumber} - ${customer.display_label || customer.name} - Smart Khata</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;600;800;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', 'Hind Siliguri', 'Segoe UI', -apple-system, sans-serif;
            padding: 24px;
            color: #0f172a;
            background: #ffffff;
            max-width: 650px;
            margin: 0 auto;
            -webkit-font-smoothing: antialiased;
          }
          .text-center { text-align: center; }
          .header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 20px;
            text-align: center;
          }
          .logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            margin: 0 auto 8px auto;
            border-radius: 12px;
            border: 1px solid #cbd5e1;
            padding: 4px;
          }
          .shop-title {
            font-size: 26px;
            font-weight: 900;
            color: #0f172a;
            margin: 4px 0;
            text-transform: uppercase;
            letter-spacing: -0.5px;
          }
          .shop-sub {
            font-size: 12px;
            color: #475569;
            margin: 2px 0;
            font-weight: 600;
          }
          .meta-grid {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .meta-col { flex: 1; }
          .meta-label { text-transform: uppercase; font-size: 10px; font-weight: 800; color: #94a3b8; }
          .meta-val { font-weight: 900; color: #0f172a; font-size: 13px; }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .items-table th {
            background: #f1f5f9;
            color: #334155;
            text-transform: uppercase;
            font-size: 10px;
            font-weight: 800;
            padding: 8px;
            border-bottom: 2px solid #cbd5e1;
          }
          .items-table td {
            padding: 8px;
            border-bottom: 1px solid #f1f5f9;
          }
          .breakdown-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .breakdown-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }
          .baki-box {
            background: #0f172a;
            color: #ffffff;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .baki-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 900;
            font-size: 10px;
            text-transform: uppercase;
          }
          .badge-paid { background: #10b981; color: #ffffff; }
          .badge-due { background: #f43f5e; color: #ffffff; }
          .footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
            font-size: 11px;
            color: #64748b;
          }
          .signature-img {
            max-height: 48px;
            object-fit: contain;
            margin-left: auto;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <!-- HEADER ORDER: SHOP ADDRESS -> SHOP OWNER -> SHOP NAME -->
        <div class="header">
          ${shop.logo_url ? `<img src="${shop.logo_url}" class="logo" alt="Logo" />` : ''}
          ${shopAddressStr ? `<div class="shop-sub">📍 ${shopAddressStr}</div>` : ''}
          ${shop.owner_name ? `<div class="shop-sub" style="font-weight:800; text-transform:uppercase;">Proprietor: ${shop.owner_name}</div>` : ''}
          <h1 class="shop-title">${shop.shop_name}</h1>
          ${shop.phone ? `<div class="shop-sub">📞 ${shop.phone}</div>` : ''}
          ${shop.gst_enabled && shop.gst_number ? `<div class="shop-sub" style="font-weight:700;">GSTIN: ${shop.gst_number}</div>` : ''}
        </div>

        <!-- META GRID: CUSTOMER & RECEIPT NO -->
        <div class="meta-grid">
          <div class="meta-col">
            <div class="meta-label">Customer Details</div>
            <div class="meta-val">${customer.display_label || customer.name}</div>
            ${customerAddressStr ? `<div>📍 ${customerAddressStr}</div>` : ''}
            ${customer.phone_number ? `<div>📞 ${customer.phone_number}</div>` : ''}
            ${customerGstinStr ? `<div>GSTIN: ${customerGstinStr}</div>` : ''}
          </div>
          <div class="meta-col" style="text-align:right;">
            <div class="meta-label">Receipt No</div>
            <div class="meta-val" style="color:#2563eb;">${receiptNumber}</div>
            <div style="margin-top:4px;">${dateFormatted} ${timeFormatted}</div>
          </div>
        </div>

        <!-- ITEMS TABLE -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align:left;">Item Description</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.map((item) => `
              <tr>
                <td style="font-weight:700;">${item.name}</td>
                <td style="text-align:center;">${item.quantity}</td>
                <td style="text-align:right;">${fmt(item.unit_price)}</td>
                <td style="text-align:right; font-weight:700;">${fmt(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- FINANCIAL BREAKDOWN -->
        <div class="breakdown-box">
          <div class="breakdown-row">
            <span>Subtotal:</span>
            <span style="font-weight:700;">${fmt(subtotal)}</span>
          </div>
          ${discountAmt > 0 ? `
            <div class="breakdown-row" style="color:#047857; font-weight:800;">
              <span>Discount (${details?.discount_type === 'percentage' ? `${details.discount_value}%` : 'Fixed'}):</span>
              <span>-${fmt(discountAmt)}</span>
            </div>
          ` : ''}
          ${hasGst ? `
            <div class="breakdown-row" style="border-top:1px solid #e2e8f0; padding-top:4px;">
              <span>Taxable Base Amount:</span>
              <span style="font-weight:700;">${fmt(taxableAmt)}</span>
            </div>
            <div style="background:#eff6ff; padding:8px; border-radius:8px; margin:6px 0; font-size:11px;">
              <div style="display:flex; justify-between; font-weight:800; color:#1e3a8a;">
                <span>GST (${tx.gst_rate}% - ${gstPriceMode === 'inclusive' ? 'Inclusive' : 'Added'}):</span>
                <span>+${fmt(tx.tax_amount || 0)}</span>
              </div>
            </div>
          ` : ''}
          <div class="breakdown-row" style="border-top:2px solid #cbd5e1; padding-top:8px; font-size:14px; font-weight:900;">
            <span>Grand Total (${typeLabel}):</span>
            <span style="color:${isCredit ? '#dc2626' : '#059669'};">${fmt(txAmt)}</span>
          </div>
        </div>

        <!-- BAKI / BALANCE BREAKDOWN -->
        <div class="baki-box">
          <div class="baki-row" style="border-bottom:1px solid #334155; padding-bottom:6px;">
            <span>Previous Baki (Before this tx):</span>
            <span style="font-weight:800; font-size:13px;">${fmt(prevBalance)}</span>
          </div>
          <div class="baki-row" style="margin-top:6px;">
            <span>Current Transaction Amount:</span>
            <span style="font-weight:800; color:${isCredit ? '#f87171' : '#34d399'};">${isCredit ? '+' : '-'}${fmt(txAmt)}</span>
          </div>
          <div class="baki-row" style="border-top:1px solid #334155; padding-top:8px; margin-top:6px; font-size:14px; font-weight:900;">
            <div>
              <span>Current Outstanding Baki:</span>
              <div style="margin-top:2px;">
                ${isFullyPaid ? '<span class="badge badge-paid">✓ FULLY PAID</span>' : '<span class="badge badge-due">⚠️ DUE BALANCE</span>'}
              </div>
            </div>
            <span style="font-size:18px; color:${currentBalance > 0 ? '#f87171' : '#34d399'};">${fmt(currentBalance)}</span>
          </div>
        </div>

        ${noteText ? `<div style="font-style:italic; background:#f8fafc; padding:8px; border-radius:8px; font-size:11px; margin-bottom:16px;">📝 Note: ${noteText}</div>` : ''}

        <!-- FOOTER & AUTHORIZED SIGNATURE -->
        <div class="footer">
          <div>
            <div style="font-weight:800; text-transform:uppercase; color:#94a3b8;">Smart Khata • Business Invoice</div>
            <div>Thank you for your business!</div>
          </div>
          ${shop.signature_url ? `
            <div style="text-align:right;">
              <img src="${shop.signature_url}" class="signature-img" alt="Signature" />
              <div style="font-size:10px; font-weight:800; text-transform:uppercase; border-top:1px solid #cbd5e1; margin-top:2px; padding-top:2px;">Authorized Signature</div>
            </div>
          ` : ''}
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
