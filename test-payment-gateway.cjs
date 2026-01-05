const { createClient } = require('@supabase/supabase-js');

// Replace these with your actual Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPaymentGatewayCredentials() {
  console.log('🔍 Fetching stores with payment gateway credentials...\n');

  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, name, payment_gateway_credentials')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!stores || stores.length === 0) {
    console.log('📭 No stores found');
    return;
  }

  console.log(`✅ Found ${stores.length} store(s)\n`);

  stores.forEach((store, index) => {
    console.log(`\n📦 Store #${index + 1}`);
    console.log(`   ID: ${store.id}`);
    console.log(`   Name: ${store.name}`);
    console.log(`   Payment Gateway Credentials:`);

    const creds = store.payment_gateway_credentials;

    if (!creds || Object.keys(creds).length === 0) {
      console.log('   ⚠️  No payment gateway credentials configured');
    } else {
      // Check each gateway
      const gateways = ['razorpay', 'phonepe', 'cashfree', 'payu', 'paytm', 'stripe'];

      gateways.forEach(gateway => {
        if (creds[gateway]) {
          const isEnabled = creds[gateway].enabled;
          const status = isEnabled ? '✅ ENABLED' : '⭕ DISABLED';
          console.log(`\n   ${gateway.toUpperCase()}: ${status}`);

          // Show fields (mask sensitive data)
          Object.keys(creds[gateway]).forEach(key => {
            if (key !== 'enabled') {
              const value = creds[gateway][key];
              const displayValue = value && value.length > 8
                ? value.substring(0, 8) + '••••••••'
                : value || '(empty)';
              console.log(`     ${key}: ${displayValue}`);
            }
          });
        }
      });
    }
    console.log('\n' + '─'.repeat(60));
  });
}

testPaymentGatewayCredentials().catch(console.error);
