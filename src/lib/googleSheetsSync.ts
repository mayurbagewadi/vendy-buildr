// Google Sheets sync utilities

import { Product } from './productData';
import { generateProductId } from './idGenerator';
import { getAccessToken } from './googleAuth';

const SPREADSHEET_ID_KEY = 'google_sheets_spreadsheet_id';
const LAST_SYNC_KEY = 'google_sheets_last_sync';

export interface SheetRow {
  product_id?: string;
  product_name: string;
  category: string;
  price_min: string;
  price_max?: string;
  description: string;
  status: string;
  main_image: string;
  additional_images?: string;
  date_added?: string;
  last_modified?: string;
}

// Save spreadsheet ID
export const saveSpreadsheetId = (id: string): void => {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
};

// Get spreadsheet ID
export const getSpreadsheetId = (): string | null => {
  return localStorage.getItem(SPREADSHEET_ID_KEY);
};

// Get last sync time
export const getLastSyncTime = (): string | null => {
  return localStorage.getItem(LAST_SYNC_KEY);
};

// Update last sync time
const updateLastSyncTime = (): void => {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
};

// Convert Sheet row to Product
const convertSheetRowToProduct = (row: SheetRow): Product => {
  const priceMin = parseFloat(row.price_min) || 0;
  const priceMax = row.price_max ? parseFloat(row.price_max) : priceMin;
  
  const images = [row.main_image];
  if (row.additional_images) {
    const additionalImages = row.additional_images.split(',').map(url => url.trim()).filter(Boolean);
    images.push(...additionalImages);
  }

  return {
    id: row.product_id || generateProductId(),
    name: row.product_name,
    description: row.description,
    category: row.category,
    basePrice: priceMin,
    priceRange: priceMin !== priceMax ? `${priceMin}-${priceMax}` : undefined,
    stock: 100, // Default stock
    status: (row.status?.toLowerCase() === 'published' ? 'published' : 'draft') as 'published' | 'draft',
    images,
    variants: priceMin !== priceMax ? [
      { name: 'Standard', price: priceMin },
      { name: 'Premium', price: priceMax }
    ] : undefined,
    createdAt: row.date_added || new Date().toISOString(),
    updatedAt: row.last_modified || new Date().toISOString(),
  };
};

// Fetch data from Google Sheets API
export const syncFromGoogleSheets = async (spreadsheetId: string): Promise<Product[]> => {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in with Google.');
    }

    // Fetch data from Google Sheets API
    const range = 'Sheet1!A2:J'; // Adjust range as needed
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    if (!rows.length) {
      throw new Error('No data found in spreadsheet');
    }

    // Convert rows to SheetRow objects
    const sheetRows: SheetRow[] = rows.map((row: string[]) => ({
      product_id: row[0] || undefined,
      product_name: row[1] || '',
      category: row[2] || '',
      price_min: row[3] || '0',
      price_max: row[4] || undefined,
      description: row[5] || '',
      status: row[6] || 'draft',
      main_image: row[7] || '',
      additional_images: row[8] || undefined,
      date_added: row[9] || undefined,
    }));

    const products = sheetRows
      .filter(row => row.product_name && row.main_image)
      .map(convertSheetRowToProduct);
    
    updateLastSyncTime();
    
    return products;
  } catch (error) {
    console.error('Error syncing from Google Sheets:', error);
    throw error;
  }
};
