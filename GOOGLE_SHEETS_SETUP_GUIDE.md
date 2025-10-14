# Google Sheets API Setup Guide

## Overview
This application uses the Google Sheets API to create and manage individual Google Sheets for each store. Each store gets its own spreadsheet with two tabs: **Products** and **Orders**.

## Prerequisites
1. A Google Cloud Project
2. Google Sheets API enabled
3. OAuth 2.0 Client ID credentials

## Step-by-Step Setup

### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "My Store Platform")
4. Click "Create"

### 2. Enable Google Sheets API
1. In your Google Cloud Project, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

### 3. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type
   - Fill in required fields (app name, support email)
   - Add scopes: `https://www.googleapis.com/auth/spreadsheets`
   - Add test users if needed
   - Save and continue

4. Back to Create OAuth Client ID:
   - Application type: **Web application**
   - Name: "Store Admin"
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - Your production domain (e.g., `https://yourdomain.com`)
   - Authorized redirect URIs:
     - `http://localhost:5173/auth` (for development)
     - Your production domain + /auth
   - Click "Create"

5. **Copy the Client ID** - it will look like: `xxxxx.apps.googleusercontent.com`

### 4. Configure in Your Application
1. Go to the onboarding flow at `/onboarding/google-sheets`
2. Paste your OAuth Client ID in the "Google OAuth Client ID" field
3. Click "Save"
4. Click "Grant Google Sheets Access"
5. Authorize the application in the Google popup
6. Once authorized, click "Create Google Sheet Automatically"

## How It Works

### Auto-Create Flow
1. User grants OAuth access to Google Sheets
2. Application calls Google Sheets API to create a new spreadsheet
3. Two sheets are created: "Products" and "Orders"
4. Headers are automatically added and formatted
5. Spreadsheet ID is saved to the store's database record
6. User can now sync products and receive orders in the sheet

### Sheet Structure

#### Products Sheet
Columns:
- `product_id`: Unique product identifier
- `product_name`: Product name
- `category`: Product category
- `price_min`: Minimum price
- `price_max`: Maximum price (for variants)
- `description`: Product description
- `status`: published/draft
- `main_image`: Main product image URL
- `additional_images`: Comma-separated image URLs
- `date_added`: Creation timestamp
- `last_modified`: Last update timestamp

#### Orders Sheet
Columns:
- `order_id`: Unique order identifier
- `customer_name`: Customer name
- `phone`: Customer phone number
- `email`: Customer email
- `address`: Delivery address
- `landmark`: Address landmark
- `pincode`: Postal code
- `delivery_time`: Preferred delivery time
- `items`: Order items (formatted string)
- `subtotal`: Subtotal amount
- `delivery_charge`: Delivery fee
- `total`: Total amount
- `order_date`: Order timestamp

## Security Considerations

### OAuth Scopes
The application requests `https://www.googleapis.com/auth/spreadsheets` scope which allows:
- Creating new spreadsheets
- Reading spreadsheet data
- Writing to spreadsheets
- Modifying spreadsheet structure

### Client ID Storage
- The OAuth Client ID is **publicly visible** and can be stored in the frontend code
- It's safe to commit to version control
- It only identifies your application, it doesn't grant access by itself

### Access Tokens
- Access tokens are stored in `localStorage`
- Tokens expire after 1 hour
- Users will need to re-authorize after expiration
- Tokens should never be shared or exposed

## Troubleshooting

### "Access denied" error
- Check that the OAuth consent screen is configured correctly
- Ensure the user's email is added as a test user (if in testing mode)
- Verify that the correct scopes are requested

### "Invalid Client ID" error
- Double-check the Client ID is copied correctly
- Ensure it ends with `.apps.googleusercontent.com`
- Verify the Client ID is from the correct Google Cloud Project

### Sheet creation fails
- Check that Google Sheets API is enabled
- Verify the access token is valid (try re-authorizing)
- Check browser console for detailed error messages

### Can't see created sheet
- The sheet is created in the Google account that authorized the app
- Check Google Drive for the newly created spreadsheet
- Look for sheets named: `[Store Name] - Products & Orders`

## API Rate Limits
Google Sheets API has the following limits:
- 500 requests per 100 seconds per project
- 100 requests per 100 seconds per user

For most stores, these limits are more than sufficient.

## Next Steps
After setting up Google Sheets:
1. Products can be synced to/from the sheet
2. Orders placed via WhatsApp will be logged to the Orders sheet
3. Store owners can manage products directly in Google Sheets
4. Changes sync back to the store in real-time

## Support
If you need help:
- Check the console logs for detailed error messages
- Review Google Cloud Console for API quotas and errors
- Contact support with your setup details
