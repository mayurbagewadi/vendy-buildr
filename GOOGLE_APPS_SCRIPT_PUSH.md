# Updated Google Apps Script for Two-Way Sync

Replace your existing Apps Script code with this updated version that supports both:
1. **GET requests**: Sync FROM Google Sheets TO your app (existing functionality)
2. **POST requests**: Push FROM your app TO Google Sheets (new functionality)

## Updated Apps Script Code

```javascript
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Remove header row
  const rows = data.slice(1);
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Create headers if sheet is empty
    if (sheet.getLastRow() === 0) {
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
        'last_modified'
      ];
      sheet.appendRow(headers);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }
    
    // Parse incoming data
    const productData = JSON.parse(e.postData.contents);
    
    // Check if product already exists
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === productData.product_id) {
        rowIndex = i + 1; // +1 because sheets are 1-indexed
        break;
      }
    }
    
    // Prepare row data
    const rowData = [
      productData.product_id,
      productData.product_name,
      productData.category,
      productData.price_min,
      productData.price_max || '',
      productData.description,
      productData.status,
      productData.main_image,
      productData.additional_images || '',
      productData.date_added,
      productData.last_modified
    ];
    
    if (rowIndex > 0) {
      // Update existing row
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Append new row
      sheet.appendRow(rowData);
    }
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, 11);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Product synced successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Deployment Instructions

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. **Replace all existing code** with the code above
4. Click **Save** (💾 icon)
5. Click **Deploy > New deployment**
6. Click the gear icon ⚙️ next to "Select type"
7. Choose **Web app**
8. Set **Execute as**: Me
9. Set **Who has access**: Anyone
10. Click **Deploy**
11. **Copy the Web App URL** (it should end with `/exec`)
12. **Important**: If you already deployed before, create a **NEW deployment** or update the existing one

## What This Script Does

### On GET Request (Sync FROM Sheets):
- Returns all product data from your Google Sheet as JSON
- Used when you click "Sync Now" in the admin panel

### On POST Request (Push TO Sheets):
- Creates column headers automatically if the sheet is empty
- Checks if a product already exists (by product_id)
- Updates the existing row if found, or appends a new row
- Formats headers with blue background
- Auto-resizes columns for better visibility

## Column Structure

The script automatically creates these columns:
1. **product_id** - Unique product identifier
2. **product_name** - Product name
3. **category** - Product category
4. **price_min** - Minimum/base price
5. **price_max** - Maximum price (for variants)
6. **description** - Product description
7. **status** - published/draft/inactive
8. **main_image** - Main product image URL
9. **additional_images** - Comma-separated additional image URLs
10. **date_added** - Creation timestamp
11. **last_modified** - Last update timestamp

## Permissions Required

When you first deploy or run the script, Google will ask for permissions:
- ✅ **Allow** access to your Google Sheets
- ✅ **Allow** external requests (for the web app to work)

## Testing

After deployment:
1. Go to your admin panel
2. Add or edit a product
3. The product will automatically be pushed to your Google Sheet!
4. Check your Google Sheet to see the data appear

## Troubleshooting

If push fails:
- Ensure the Web App URL is correctly saved in the app
- Make sure you deployed as "Anyone" can access
- Try creating a NEW deployment (not updating an existing one)
- Check that the script has permissions to edit your sheet
