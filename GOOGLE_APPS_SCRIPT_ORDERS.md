# Google Apps Script - Orders Tracking

This updated script handles both **products** and **orders** in separate sheets.

## Updated Apps Script Code

Replace your existing Apps Script with this version:

```javascript
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({error: 'Products sheet not found'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const data = sheet.getDataRange().getValues();
  
  // Remove header row
  const rows = data.slice(1);
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Parse incoming data
    const postData = JSON.parse(e.postData.contents);
    
    // Check if this is an order or a product
    if (postData._type === 'order') {
      return handleOrder(spreadsheet, postData);
    } else {
      return handleProduct(spreadsheet, postData);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleProduct(spreadsheet, productData) {
  let sheet = spreadsheet.getSheetByName('Products');
  
  // Create Products sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Products');
    
    // Create headers
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
  
  // Handle delete action
  if (productData.action === 'delete') {
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === productData.product_id) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'Product deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Product not found'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Check if product already exists
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === productData.product_id) {
      rowIndex = i + 1;
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
}

function handleOrder(spreadsheet, orderData) {
  let sheet = spreadsheet.getSheetByName('Orders');
  
  // Create Orders sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Orders');
    
    // Create headers
    const headers = [
      'Order ID',
      'Order Date',
      'Customer Name',
      'Phone',
      'Email',
      'Address',
      'Landmark',
      'PIN Code',
      'Delivery Time',
      'Items',
      'Subtotal',
      'Delivery Charge',
      'Total',
      'Status'
    ];
    sheet.appendRow(headers);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#34a853');
    headerRange.setFontColor('#ffffff');
  }
  
  // Prepare row data
  const rowData = [
    orderData.orderId,
    orderData.orderDate,
    orderData.customerName,
    orderData.phone,
    orderData.email || '',
    orderData.address,
    orderData.landmark || '',
    orderData.pincode,
    orderData.deliveryTime,
    orderData.items,
    orderData.subtotal,
    orderData.deliveryCharge,
    orderData.total,
    orderData.status || 'Pending'
  ];
  
  // Always append new orders (don't update)
  sheet.appendRow(rowData);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 14);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Order saved successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}
```

## What This Does

### For Products (Products Sheet):
- Creates/updates products in a "Products" sheet
- Blue header with product columns
- Updates existing products by product_id
- Auto-syncs when you add/edit products in admin panel

### For Orders (Orders Sheet):
- Creates a separate "Orders" sheet automatically
- Green header with order columns
- Saves every order placed via WhatsApp
- Tracks: Order ID, customer details, items, pricing, delivery info
- Each order is appended (no updates)

## Deployment

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. **Replace all code** with the code above
4. Click **Save**
5. Click **Deploy > New deployment** (or manage deployments to update existing)
6. Choose **Web app**
7. Set **Execute as**: Me
8. Set **Who has access**: Anyone
9. Click **Deploy**
10. Copy the Web App URL
11. Paste it in Admin > Google Sheets Sync > Script URL

## Testing

1. Add/edit a product in admin panel → Check "Products" sheet
2. Place an order on the website → Check "Orders" sheet
3. Both sheets are created automatically on first use

## Sheet Structure

**Products Sheet:**
- product_id | product_name | category | price_min | price_max | description | status | main_image | additional_images | date_added | last_modified

**Orders Sheet:**
- Order ID | Order Date | Customer Name | Phone | Email | Address | Landmark | PIN Code | Delivery Time | Items | Subtotal | Delivery Charge | Total | Status
