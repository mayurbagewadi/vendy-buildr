# Subscription Renewal System

## Overview
This system handles automatic and manual subscription renewals with smart business logic to prevent abuse of free plans and one-time purchases.

## How It Works

### 1. Daily Expiration Check (Automated)
- **Runs**: Every day at 2:00 AM
- **Function**: `check_and_process_expired_subscriptions()`
- **Location**: Database function (scheduled via pg_cron)

### 2. Subscription Types & Behavior

#### Free Plans & Trials
```
When period ends:
❌ DON'T auto-renew
❌ DON'T reset order counters
✅ Set status = 'expired'
→ User must upgrade to continue
```

#### One-Time Purchases (No Payment Gateway)
```
When period ends:
❌ DON'T auto-renew
❌ DON'T reset order counters
✅ Set status = 'expired'
→ User must manually renew (pay again)
```

#### Recurring Subscriptions (With Payment Gateway)
```
When period ends:
✅ Set status = 'pending_payment'
→ Awaiting payment gateway integration
→ Once payment succeeds:
  - Reset order counters to 0
  - Extend period by 1 month/year
  - Set status = 'active'
```

## Examples

### Example 1: Free Plan User
```
User: Testing Store
Plan: Free (2 orders/month)
Period: Oct 1 - Nov 1

Activity:
- Oct 5: Order #1 (orders_used = 1)
- Oct 10: Order #2 (orders_used = 2)
- Oct 15: Tries order #3 → ❌ BLOCKED

Nov 1st (Auto-Process):
- Status → 'expired'
- orders_used stays at 2
- User CANNOT place more orders
- Must upgrade to Pro
```

### Example 2: Pro Plan (One-Time)
```
User: Sarah's Shop
Plan: Pro ₹299 (one-time payment)
Period: Oct 1 - Nov 1

Activity:
- Places 50 orders (orders_used = 50)

Nov 1st (Auto-Process):
- Status → 'expired'
- orders_used stays at 50
- User CANNOT place more orders
- Must manually pay ₹299 again
```

### Example 3: Pro Plan (Recurring - Future)
```
User: Mike's Store
Plan: Pro ₹299/month (Razorpay auto-pay)
Period: Oct 1 - Nov 1

Activity:
- Places 100 orders (orders_used = 100)

Nov 1st (Auto-Process):
- Status → 'pending_payment'
- Payment gateway charges ₹299
- If SUCCESS:
  - orders_used → 0
  - Period → Nov 1 - Dec 1
  - Status → 'active'
- If FAILED:
  - Status → 'expired'
  - orders_used stays at 100
```

## Manual Renewal (Super Admin)

### UI Location
**Super Admin → Users → User Details → Subscription Tab**

### How to Use
1. Click "Renew Subscription" button
2. Review current order usage
3. Choose: Reset order counters? (Yes/No)
4. Click "Renew Subscription"

### What It Does
- Sets status to 'active'
- Extends period by 1 month/year (based on billing cycle)
- Optionally resets order counters to 0
- Updates next_billing_at date

## Database Functions

### 1. check_and_process_expired_subscriptions()
**Purpose**: Automated daily check for expired subscriptions
**Schedule**: Every day at 2:00 AM
**Actions**:
- Finds subscriptions where `current_period_end < NOW()`
- Processes based on subscription type (see above)
- Logs actions in database

### 2. renew_subscription(subscription_id, reset_counters)
**Purpose**: Manual renewal by super admin
**Parameters**:
- `subscription_id` (uuid): The subscription to renew
- `reset_counters` (boolean): Whether to reset order counts (default: true)

**Actions**:
- Calculates new period dates
- Sets status to 'active'
- Optionally resets `whatsapp_orders_used` and `website_orders_used` to 0
- Updates `current_period_start`, `current_period_end`, `next_billing_at`

### 3. process_successful_payment(subscription_id, payment_gateway_name, payment_id)
**Purpose**: Handle successful payment from payment gateway webhook
**Parameters**:
- `subscription_id` (uuid): The subscription that was paid
- `payment_gateway_name` (text): "razorpay", "stripe", etc.
- `payment_id` (text): Transaction ID from gateway

**Actions**:
- Renews subscription automatically
- ALWAYS resets order counters to 0
- Extends period based on billing cycle
- Updates payment_gateway field

## Payment Gateway Integration (Future)

When integrating Razorpay/Stripe:

1. **Update the cron function** to call payment gateway API
2. **On successful payment**: Call `process_successful_payment()`
3. **On failed payment**: Send notification to user
4. **Add webhook endpoint** to receive payment confirmations

### Webhook Example (Future)
```typescript
// /api/webhooks/razorpay
export async function POST(request: Request) {
  const payload = await request.json();

  if (payload.event === "subscription.charged") {
    await supabase.rpc("process_successful_payment", {
      subscription_id: payload.subscription_id,
      payment_gateway_name: "razorpay",
      payment_id: payload.payment_id
    });
  }
}
```

## Status Types

| Status | Description |
|--------|-------------|
| `trial` | User is in trial period |
| `active` | Subscription is active and paid |
| `expired` | Subscription period ended, no renewal |
| `cancelled` | User cancelled subscription |
| `pending_payment` | Awaiting payment gateway processing |

## Testing

### Run Migration
```sql
-- Run both migrations in Supabase SQL Editor:
1. supabase/migrations/20251029140000_subscription_renewal_system.sql
2. supabase/migrations/20251029140100_add_pending_payment_status.sql
```

### Manual Test - Free Plan Expiration
```sql
-- Set a subscription to expired
UPDATE subscriptions
SET current_period_end = NOW() - INTERVAL '1 day'
WHERE user_id = 'test-user-id';

-- Run the function manually
SELECT check_and_process_expired_subscriptions();

-- Verify status changed to 'expired'
SELECT status, whatsapp_orders_used, website_orders_used
FROM subscriptions
WHERE user_id = 'test-user-id';
```

### Manual Test - Renew Subscription
```sql
-- Via Super Admin UI or SQL:
SELECT renew_subscription(
  'subscription-uuid-here',
  true  -- reset counters
);

-- Verify renewal
SELECT status, current_period_end, whatsapp_orders_used
FROM subscriptions
WHERE id = 'subscription-uuid-here';
```

## Security Notes

- ✅ Only super admins can manually renew subscriptions
- ✅ Payment gateway webhooks should verify signatures
- ✅ Free plans cannot auto-renew (prevents abuse)
- ✅ Order counters preserved for expired subscriptions (audit trail)

## Future Enhancements

1. **Email Notifications**
   - 7 days before expiration
   - On expiration
   - On successful renewal

2. **Payment Gateway Integration**
   - Razorpay recurring payments
   - Stripe subscriptions
   - Payment retry logic

3. **Grace Period**
   - Allow 3-day grace period for failed payments
   - Automatically retry payment

4. **Proration**
   - Handle mid-cycle plan changes
   - Calculate prorated refunds/charges
