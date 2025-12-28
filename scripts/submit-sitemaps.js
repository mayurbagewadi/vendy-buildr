/**
 * Google Search Console API - Automated Sitemap Submission
 *
 * Automatically submits sitemaps for all stores to Google Search Console
 * Can be run manually, via cron, or triggered on store creation
 */

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vexeuxsvckpfvuxqchqu.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS; // Path to service account JSON

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Submit sitemap to Google Search Console
 */
async function submitSitemap(siteUrl, sitemapUrl) {
  try {
    console.log(`\n📤 Submitting sitemap for: ${siteUrl}`);
    console.log(`   Sitemap URL: ${sitemapUrl}`);

    // Initialize Google Search Console API
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/webmasters'],
    });

    const searchconsole = google.searchconsole({
      version: 'v1',
      auth: auth,
    });

    // Submit sitemap
    const response = await searchconsole.sitemaps.submit({
      siteUrl: siteUrl,
      feedpath: sitemapUrl,
    });

    console.log(`   ✅ Sitemap submitted successfully!`);
    return { success: true, siteUrl, sitemapUrl };

  } catch (error) {
    console.error(`   ❌ Error submitting sitemap for ${siteUrl}:`, error.message);
    return { success: false, siteUrl, sitemapUrl, error: error.message };
  }
}

/**
 * Get all active stores from database
 */
async function getAllStores() {
  try {
    const { data: stores, error } = await supabase
      .from('stores')
      .select('id, slug, subdomain, custom_domain, name')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`\n📊 Found ${stores?.length || 0} active stores`);
    return stores || [];

  } catch (error) {
    console.error('❌ Error fetching stores:', error);
    return [];
  }
}

/**
 * Build site URL and sitemap URL for a store
 */
function getStoreUrls(store) {
  let siteUrl = '';

  // Priority: custom_domain > subdomain > slug
  if (store.custom_domain) {
    siteUrl = `https://${store.custom_domain}`;
  } else if (store.subdomain) {
    siteUrl = `https://${store.subdomain}.digitaldukandar.in`;
  } else {
    siteUrl = `https://digitaldukandar.in/${store.slug}`;
  }

  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  return { siteUrl, sitemapUrl };
}

/**
 * Main function - Submit sitemaps for all stores
 */
async function submitAllSitemaps() {
  console.log('🚀 Starting automated sitemap submission...\n');

  // Check for credentials
  if (!GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('❌ Error: GOOGLE_APPLICATION_CREDENTIALS environment variable not set!');
    console.error('   Please set it to the path of your service account JSON file.');
    process.exit(1);
  }

  if (!SUPABASE_KEY) {
    console.error('❌ Error: VITE_SUPABASE_PUBLISHABLE_KEY environment variable not set!');
    process.exit(1);
  }

  // Submit main platform sitemap
  console.log('📍 Submitting main platform sitemap...');
  await submitSitemap(
    'https://digitaldukandar.in',
    'https://digitaldukandar.in/sitemap.xml'
  );

  // Get all stores
  const stores = await getAllStores();

  if (stores.length === 0) {
    console.log('\n⚠️  No active stores found. Exiting.');
    return;
  }

  // Submit sitemap for each store
  const results = [];
  for (const store of stores) {
    const { siteUrl, sitemapUrl } = getStoreUrls(store);
    const result = await submitSitemap(siteUrl, sitemapUrl);
    results.push(result);

    // Rate limiting - wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUBMISSION SUMMARY');
  console.log('='.repeat(50));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Successfully submitted: ${successful + 1}`); // +1 for main platform
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed submissions:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.siteUrl}: ${r.error}`);
    });
  }

  console.log('\n✨ Done!\n');
}

// Run the script
if (require.main === module) {
  submitAllSitemaps()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { submitSitemap, submitAllSitemaps };
