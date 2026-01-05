#!/usr/bin/env node

/**
 * Database Cleanup Script for Leftover Commission Data
 *
 * This script cleans up leftover commission values in the database:
 * - When commission_model is "onetime", clears recurring_value and recurring_duration
 * - When commission_model is "recurring", clears onetime_value
 * - When commission_model is "hybrid", keeps all values
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  lines.forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug output
console.log('Debug: VITE_SUPABASE_URL =', supabaseUrl ? 'found' : 'missing');
console.log('Debug: VITE_SUPABASE_PUBLISHABLE_KEY =', process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'found' : 'missing');
console.log('Debug: Key length =', supabaseKey ? supabaseKey.length : 0);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env file');
  console.error('   Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧹 Starting Commission Data Cleanup...\n');

async function cleanupPlanCommission() {
  console.log('📋 Cleaning plan_commission table...');

  // Find records with leftover data (onetime model with recurring values)
  const { data: onetimeLeftovers, error: error1 } = await supabase
    .from('plan_commission')
    .select('id, plan_id, subscription_type, commission_model, recurring_value, recurring_duration')
    .eq('commission_model', 'onetime')
    .or('recurring_value.neq.0,recurring_duration.neq.0');

  if (error1) {
    console.error('   ❌ Error finding onetime leftovers:', error1.message);
  } else {
    console.log(`   Found ${onetimeLeftovers?.length || 0} records with leftover recurring values`);

    if (onetimeLeftovers && onetimeLeftovers.length > 0) {
      // Clear recurring values for onetime model
      for (const record of onetimeLeftovers) {
        const { error } = await supabase
          .from('plan_commission')
          .update({
            recurring_value: 0,
            recurring_duration: 0
          })
          .eq('id', record.id);

        if (error) {
          console.error(`   ❌ Error updating record ${record.id}:`, error.message);
        }
      }
      console.log(`   ✅ Cleared recurring values from ${onetimeLeftovers.length} onetime records`);
    }
  }

  // Find records with leftover data (recurring model with onetime values)
  const { data: recurringLeftovers, error: error2 } = await supabase
    .from('plan_commission')
    .select('id, plan_id, subscription_type, commission_model, onetime_value')
    .eq('commission_model', 'recurring')
    .neq('onetime_value', 0);

  if (error2) {
    console.error('   ❌ Error finding recurring leftovers:', error2.message);
  } else {
    console.log(`   Found ${recurringLeftovers?.length || 0} records with leftover onetime values`);

    if (recurringLeftovers && recurringLeftovers.length > 0) {
      // Clear onetime values for recurring model
      for (const record of recurringLeftovers) {
        const { error } = await supabase
          .from('plan_commission')
          .update({
            onetime_value: 0
          })
          .eq('id', record.id);

        if (error) {
          console.error(`   ❌ Error updating record ${record.id}:`, error.message);
        }
      }
      console.log(`   ✅ Cleared onetime values from ${recurringLeftovers.length} recurring records`);
    }
  }

  console.log('   ✅ plan_commission cleanup complete\n');
}

async function cleanupNetworkCommission() {
  console.log('🌐 Cleaning network_commission table...');

  // Find records with leftover data (onetime model with recurring values)
  const { data: onetimeLeftovers, error: error1 } = await supabase
    .from('network_commission')
    .select('id, subscription_type, commission_model, recurring_value, recurring_duration')
    .eq('commission_model', 'onetime')
    .or('recurring_value.neq.0,recurring_duration.neq.0');

  if (error1) {
    console.error('   ❌ Error finding onetime leftovers:', error1.message);
  } else {
    console.log(`   Found ${onetimeLeftovers?.length || 0} records with leftover recurring values`);

    if (onetimeLeftovers && onetimeLeftovers.length > 0) {
      // Clear recurring values for onetime model
      for (const record of onetimeLeftovers) {
        const { error } = await supabase
          .from('network_commission')
          .update({
            recurring_value: 0,
            recurring_duration: 0
          })
          .eq('id', record.id);

        if (error) {
          console.error(`   ❌ Error updating record ${record.id}:`, error.message);
        }
      }
      console.log(`   ✅ Cleared recurring values from ${onetimeLeftovers.length} onetime records`);
    }
  }

  // Find records with leftover data (recurring model with onetime values)
  const { data: recurringLeftovers, error: error2 } = await supabase
    .from('network_commission')
    .select('id, subscription_type, commission_model, onetime_value')
    .eq('commission_model', 'recurring')
    .neq('onetime_value', 0);

  if (error2) {
    console.error('   ❌ Error finding recurring leftovers:', error2.message);
  } else {
    console.log(`   Found ${recurringLeftovers?.length || 0} records with leftover onetime values`);

    if (recurringLeftovers && recurringLeftovers.length > 0) {
      // Clear onetime values for recurring model
      for (const record of recurringLeftovers) {
        const { error } = await supabase
          .from('network_commission')
          .update({
            onetime_value: 0
          })
          .eq('id', record.id);

        if (error) {
          console.error(`   ❌ Error updating record ${record.id}:`, error.message);
        }
      }
      console.log(`   ✅ Cleared onetime values from ${recurringLeftovers.length} recurring records`);
    }
  }

  console.log('   ✅ network_commission cleanup complete\n');
}

async function verifyCleanup() {
  console.log('🔍 Verifying cleanup...');

  // Check for any remaining leftover data
  const { data: planLeftovers } = await supabase
    .from('plan_commission')
    .select('id, commission_model, onetime_value, recurring_value')
    .or('commission_model.eq.onetime.and.recurring_value.neq.0,commission_model.eq.recurring.and.onetime_value.neq.0');

  const { data: networkLeftovers } = await supabase
    .from('network_commission')
    .select('id, commission_model, onetime_value, recurring_value')
    .or('commission_model.eq.onetime.and.recurring_value.neq.0,commission_model.eq.recurring.and.onetime_value.neq.0');

  const totalLeftovers = (planLeftovers?.length || 0) + (networkLeftovers?.length || 0);

  if (totalLeftovers === 0) {
    console.log('   ✅ No leftover data found - cleanup successful!\n');
  } else {
    console.log(`   ⚠️  Found ${totalLeftovers} records still with leftover data`);
    if (planLeftovers && planLeftovers.length > 0) {
      console.log(`   - plan_commission: ${planLeftovers.length} records`);
    }
    if (networkLeftovers && networkLeftovers.length > 0) {
      console.log(`   - network_commission: ${networkLeftovers.length} records`);
    }
    console.log('');
  }
}

async function main() {
  try {
    await cleanupPlanCommission();
    await cleanupNetworkCommission();
    await verifyCleanup();

    console.log('='.repeat(50));
    console.log('✅ Cleanup completed successfully!');
    console.log('='.repeat(50));
    console.log('\n📝 Next steps:');
    console.log('1. Refresh the Commission Settings page');
    console.log('2. Check that all values display correctly');
    console.log('3. Future saves will automatically clean leftover data\n');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

main();
