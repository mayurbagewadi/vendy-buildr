import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the cleanup configuration from the request body
    const { 
      ordersMonths = 6,
      activeLogsMonths = 6,
      inactiveLogsMonths = 6,
      cleanupOrders = true,
      cleanupActiveLogs = false,
      cleanupInactiveLogs = false
    } = await req.json().catch(() => ({}));
    
    const results = {
      orders: null as any,
      activeLogs: null as any,
      inactiveLogs: null as any
    };

    // Delete old orders
    if (cleanupOrders) {
      let ordersCutoff: Date;
      
      // If months is very high (9999), delete ALL orders by using future date
      if (ordersMonths >= 9999) {
        ordersCutoff = new Date('2099-12-31');
        console.log('Cleaning up ALL orders (no date restriction)');
      } else {
        ordersCutoff = new Date();
        ordersCutoff.setMonth(ordersCutoff.getMonth() - ordersMonths);
        console.log(`Cleaning up orders older than: ${ordersCutoff.toISOString()}`);
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .delete()
        .lt('created_at', ordersCutoff.toISOString())
        .select('id');

      if (ordersError) {
        console.error('Error deleting old orders:', ordersError);
        results.orders = { error: ordersError.message };
      } else {
        const ordersCount = ordersData?.length || 0;
        console.log(`Successfully deleted ${ordersCount} orders older than ${ordersMonths} months`);
        results.orders = { success: true, deleted: ordersCount, cutoffDate: ordersCutoff.toISOString() };
      }
    }

    // Delete old active logs
    if (cleanupActiveLogs) {
      let activeLogsCutoff: Date;
      
      // If months is very high (9999), delete ALL active logs by using future date
      if (activeLogsMonths >= 9999) {
        activeLogsCutoff = new Date('2099-12-31');
        console.log('Cleaning up ALL active logs (no date restriction)');
      } else {
        activeLogsCutoff = new Date();
        activeLogsCutoff.setMonth(activeLogsCutoff.getMonth() - activeLogsMonths);
        console.log(`Cleaning up active logs older than: ${activeLogsCutoff.toISOString()}`);
      }

      const { data: activeData, error: activeError } = await supabase
        .from('store_activity_logs')
        .delete()
        .eq('status', 'active')
        .lt('created_at', activeLogsCutoff.toISOString())
        .select('id');

      if (activeError) {
        console.error('Error deleting old active logs:', activeError);
        results.activeLogs = { error: activeError.message };
      } else {
        const activeCount = activeData?.length || 0;
        console.log(`Successfully deleted ${activeCount} active logs older than ${activeLogsMonths} months`);
        results.activeLogs = { success: true, deleted: activeCount, cutoffDate: activeLogsCutoff.toISOString() };
      }
    }

    // Delete old inactive logs
    if (cleanupInactiveLogs) {
      let inactiveLogsCutoff: Date;
      
      // If months is very high (9999), delete ALL inactive logs by using future date
      if (inactiveLogsMonths >= 9999) {
        inactiveLogsCutoff = new Date('2099-12-31');
        console.log('Cleaning up ALL inactive logs (no date restriction)');
      } else {
        inactiveLogsCutoff = new Date();
        inactiveLogsCutoff.setMonth(inactiveLogsCutoff.getMonth() - inactiveLogsMonths);
        console.log(`Cleaning up inactive logs older than: ${inactiveLogsCutoff.toISOString()}`);
      }

      const { data: inactiveData, error: inactiveError } = await supabase
        .from('store_activity_logs')
        .delete()
        .eq('status', 'inactive')
        .lt('created_at', inactiveLogsCutoff.toISOString())
        .select('id');

      if (inactiveError) {
        console.error('Error deleting old inactive logs:', inactiveError);
        results.inactiveLogs = { error: inactiveError.message };
      } else {
        const inactiveCount = inactiveData?.length || 0;
        console.log(`Successfully deleted ${inactiveCount} inactive logs older than ${inactiveLogsMonths} months`);
        results.inactiveLogs = { success: true, deleted: inactiveCount, cutoffDate: inactiveLogsCutoff.toISOString() };
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in cleanup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});