// Google Sheets API - Create and setup sheets for stores

import { getAccessToken } from './googleAuth';

export interface SheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  webAppUrl?: string;
}

// Create a new Google Sheet for a store
export const createStoreSheet = async (storeName: string): Promise<SheetCreationResult> => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated with Google. Please grant access first.');
  }

  try {
    // Create a new spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `${storeName} - Products & Orders`,
        },
        sheets: [
          {
            properties: {
              title: 'Products',
              gridProperties: {
                rowCount: 1000,
                columnCount: 11,
                frozenRowCount: 1,
              },
            },
          },
          {
            properties: {
              title: 'Orders',
              gridProperties: {
                rowCount: 1000,
                columnCount: 13,
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to create spreadsheet');
    }

    const spreadsheetData = await createResponse.json();
    const spreadsheetId = spreadsheetData.spreadsheetId;
    const spreadsheetUrl = spreadsheetData.spreadsheetUrl;

    console.log('Created spreadsheet:', spreadsheetId);

    // Setup headers for Products sheet
    await setupProductsSheet(accessToken, spreadsheetId);
    
    // Setup headers for Orders sheet
    await setupOrdersSheet(accessToken, spreadsheetId);

    return {
      spreadsheetId,
      spreadsheetUrl,
    };
  } catch (error) {
    console.error('Error creating Google Sheet:', error);
    throw error;
  }
};

// Setup Products sheet with headers and formatting
const setupProductsSheet = async (accessToken: string, spreadsheetId: string): Promise<void> => {
  const headers = [
    'product_id',
    'product_name',
    'category',
    'price_min',
    'price_max',
    'description',
    'status',
    'main_image',
    'additional_images',
    'date_added',
    'last_modified',
  ];

  // Add headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A1:K1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  // Format headers (bold, background color)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.6, blue: 1 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 11,
              },
            },
          },
        ],
      }),
    }
  );

  console.log('Products sheet setup complete');
};

// Setup Orders sheet with headers and formatting
const setupOrdersSheet = async (accessToken: string, spreadsheetId: string): Promise<void> => {
  const headers = [
    'order_id',
    'customer_name',
    'phone',
    'email',
    'address',
    'landmark',
    'pincode',
    'delivery_time',
    'items',
    'subtotal',
    'delivery_charge',
    'total',
    'order_date',
  ];

  // Get sheet ID for Orders sheet
  const sheetsResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  const sheetsData = await sheetsResponse.json();
  const ordersSheet = sheetsData.sheets.find((s: any) => s.properties.title === 'Orders');
  const ordersSheetId = ordersSheet?.properties.sheetId || 1;

  // Add headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:M1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  // Format headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: ordersSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.8, blue: 0.4 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: ordersSheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 13,
              },
            },
          },
        ],
      }),
    }
  );

  console.log('Orders sheet setup complete');
};

// Get sheet metadata
export const getSheetMetadata = async (spreadsheetId: string): Promise<any> => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch sheet metadata');
  }

  return response.json();
};
