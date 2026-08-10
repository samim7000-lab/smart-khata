import { Customer, Shop, Transaction } from '../types';

export interface BackupData {
  version: string;
  timestamp: string;
  shop: Shop;
  customers: Customer[];
  transactions: Transaction[];
}

// Export JSON Backup file
export const exportBackupJSON = (
  shop: Shop,
  customers: Customer[],
  transactions: Transaction[]
) => {
  const backupPayload: BackupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    shop,
    customers,
    transactions,
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(backupPayload, null, 2)
  )}`;

  const downloadAnchor = document.createElement('a');
  const sanitizedShopName = shop.shop_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateTag = new Date().toISOString().split('T')[0];

  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `smart_khata_backup_${sanitizedShopName}_${dateTag}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

// Import JSON Backup file
export const importBackupJSON = (
  file: File,
  onSuccess: (data: BackupData) => void,
  onError: (errMessage: string) => void
) => {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const content = event.target?.result as string;
      const parsed = JSON.parse(content);

      if (!parsed || !parsed.shop || !Array.isArray(parsed.customers) || !Array.isArray(parsed.transactions)) {
        onError('Invalid backup file format. Missing required shop, customer, or transaction records.');
        return;
      }

      onSuccess(parsed as BackupData);
    } catch (err: any) {
      onError('Failed to parse backup JSON file: ' + err.message);
    }
  };

  reader.onerror = () => {
    onError('Error reading file from disk.');
  };

  reader.readAsText(file);
};
