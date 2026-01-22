# Marketplace Payment Edge Function

Enterprise-level edge function for handling marketplace feature purchases securely.

## Purpose

This edge function handles all payment operations for marketplace features:
- Creates Razorpay orders
- Verifies payment signatures
- Creates purchase records
- Manages subscriptions and quotas

## Why Edge Function?

**Security:** Payment credentials (API keys) are stored in `platform_settings` table which has RLS policies allowing only super admins to read. By using an edge function with service role key, we can:
- Access credentials securely server-side
- Never expose secrets to the client
- Follow enterprise security best practices

## Deployment

### 1. Deploy the Function

```bash
# Deploy to Supabase
supabase functions deploy marketplace-payment
```

### 2. Set Environment Variables (Optional)

If you want to use environment variables instead of database:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxxxx
supabase secrets set RAZORPAY_KEY_SECRET=your_secret_key
```

**Note:** The function prioritizes database credentials over env variables.

### 3. Verify Deployment

```bash
# Test the function
curl -X POST 'https://your-project.supabase.co/functions/v1/marketplace-payment' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "create_order",
    "feature_slug": "google-reviews",
    "pricing_type": "monthly",
    "store_id": "xxx",
    "user_id": "yyy"
  }'
```

## API Reference

### Create Order

**Request:**
```json
{
  "action": "create_order",
  "feature_slug": "google-reviews",
  "pricing_type": "onetime|monthly|yearly",
  "store_id": "uuid",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "order_xxxxx",
  "amount": 19900,
  "currency": "INR",
  "key_id": "rzp_live_xxxxx",
  "feature_name": "Google Reviews",
  "quota": 30
}
```

### Verify Payment

**Request:**
```json
{
  "action": "verify_payment",
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature",
  "feature_slug": "google-reviews",
  "pricing_type": "monthly",
  "store_id": "uuid",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "purchase": {
    "id": "uuid",
    "feature_slug": "google-reviews",
    "quota_limit": 30,
    "expires_at": "2024-02-20T00:00:00Z",
    "status": "active"
  }
}
```

## Error Handling

**Common Errors:**

1. **Platform settings not found**
   - Ensure `platform_settings` table has a row with Razorpay credentials
   - Check RLS policies

2. **Feature not found**
   - Verify feature exists in `marketplace_features` table
   - Check feature slug matches

3. **Invalid signature**
   - Razorpay signature verification failed
   - Possible MITM attack or incorrect secret key

4. **Already purchased**
   - User already has an active purchase for this feature
   - Check `marketplace_purchases` table

## Security Features

- ✅ Server-side credential management
- ✅ HMAC SHA256 signature verification
- ✅ Service role authentication
- ✅ CORS headers configured
- ✅ Input validation
- ✅ Error logging

## Database Tables Used

### Read From:
- `platform_settings` - Razorpay credentials
- `marketplace_features` - Feature pricing
- `marketplace_purchases` - Existing purchases (check)

### Write To:
- `marketplace_purchases` - New purchase records

## Local Development

```bash
# Start Supabase locally
supabase start

# Serve function locally
supabase functions serve marketplace-payment

# Test locally
curl -X POST 'http://localhost:54321/functions/v1/marketplace-payment' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action":"create_order",...}'
```

## Logs

View function logs:

```bash
# Real-time logs
supabase functions logs marketplace-payment --tail

# Recent logs
supabase functions logs marketplace-payment
```

## Monitoring

Monitor function performance in Supabase Dashboard:
- Edge Functions → marketplace-payment
- View invocations, errors, latency
- Check logs for issues

## Related Files

- **Client Service:** `src/lib/marketplace/paymentService.ts`
- **UI Component:** `src/components/marketplace/MarketplacePaymentModal.tsx`
- **Page Integration:** `src/pages/admin/Marketplace.tsx`
- **Architecture Doc:** `MARKETPLACE_PAYMENT_ARCHITECTURE.md`

## Troubleshooting

### Issue: "Platform settings not found"
**Solution:**
```sql
-- Check if settings exist
SELECT * FROM platform_settings;

-- If empty, insert default row
INSERT INTO platform_settings (id, razorpay_key_id, razorpay_key_secret)
VALUES ('00000000-0000-0000-0000-000000000000', 'your_key_id', 'your_secret');
```

### Issue: "Signature verification failed"
**Solution:**
- Verify `razorpay_key_secret` is correct in database
- Check if using test vs live keys
- Ensure signature is passed correctly from client

### Issue: "Failed to create purchase record"
**Solution:**
- Check RLS policies on `marketplace_purchases`
- Verify all required fields are provided
- Check for unique constraint violations (already purchased)

## Support

For issues or questions:
1. Check function logs
2. Review architecture documentation
3. Verify database configuration
4. Check Razorpay dashboard for payment status
