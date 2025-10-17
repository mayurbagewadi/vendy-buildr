import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get cleanup interval from request body, default to 6 months
    const { months = 6 } = await req.json().catch(() => ({ months: 6 }));
    
    // Calculate cutoff date based on interval
    const cutoffDateObj = new Date();
    cutoffDateObj.setMonth(cutoffDateObj.getMonth() - months);
    const cutoffDate = cutoffDateObj.toISOString();

    console.log(`Cleaning up orders older than: ${cutoffDate}`);

    // Delete orders older than 2 months
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .lt('created_at', cutoffDate)
      .select('id, order_number, created_at');

    if (error) {
      console.error('Error deleting old orders:', error);
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`Successfully deleted ${deletedCount} orders`);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        cutoffDate,
        deletedOrders: data || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
