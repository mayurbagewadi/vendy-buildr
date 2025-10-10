// Google Sheets sync utilities

import { Product } from './productData';
import { generateProductId } from './idGenerator';

const WEBHOOK_URL_KEY = 'google_sheets_webhook_url';
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

// Save webhook URL
export const saveWebhookUrl = (url: string): void => {
  localStorage.setItem(WEBHOOK_URL_KEY, url);
};

// Get webhook URL
export const getWebhookUrl = (): string | null => {
  return localStorage.getItem(WEBHOOK_URL_KEY);
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

// Fetch data from Google Sheets webhook
export const syncFromGoogleSheets = async (webhookUrl: string): Promise<Product[]> => {
  try {
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Expected format: { data: SheetRow[] } or SheetRow[]
    const rows: SheetRow[] = Array.isArray(data) ? data : data.data;
    
    if (!rows || !Array.isArray(rows)) {
      throw new Error('Invalid data format received from webhook');
    }

    const products = rows.map(convertSheetRowToProduct);
    
    updateLastSyncTime();
    
    return products;
  } catch (error) {
    console.error('Error syncing from Google Sheets:', error);
    throw error;
  }
};
