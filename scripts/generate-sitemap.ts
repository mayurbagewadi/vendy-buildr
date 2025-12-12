#!/usr/bin/env node
/**
 * Sitemap Generation Script
 * Generates sitemap.xml with all platform, store, and product pages
 *
 * Usage: npm run generate-sitemap
 * or: npx tsx scripts/generate-sitemap.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateCompleteSitemap } from '../src/lib/seo/sitemapGenerator';

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Base URL of your website
const BASE_URL = process.env.VITE_BASE_URL || 'https://yesgive.shop';

async function main() {
  console.log('🚀 Starting sitemap generation...\n');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Fetch all stores
    console.log('📦 Fetching stores...');
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('slug, updated_at, subdomain, custom_domain')
      .order('updated_at', { ascending: false });

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    console.log(`✅ Found ${stores?.length || 0} stores\n`);

    // Fetch all published products with store information
    console.log('🛍️  Fetching products...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        updated_at,
        created_at,
        status,
        store_id,
        stores!inner (
          slug,
          subdomain,
          custom_domain
        )
      `)
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    // Transform products data to match expected format
    const formattedProducts = products?.map((product: any) => ({
      id: product.id,
      store_slug: product.stores.slug,
      store_subdomain: product.stores.subdomain,
      store_custom_domain: product.stores.custom_domain,
      updated_at: product.updated_at,
      created_at: product.created_at
    })) || [];

    console.log(`✅ Found ${formattedProducts.length} published products\n`);

    // Generate sitemap
    console.log('🗺️  Generating sitemap XML...');
    const sitemapXML = await generateCompleteSitemap(
      BASE_URL,
      stores || [],
      formattedProducts
    );

    // Write sitemap to public directory
    const publicDir = path.join(process.cwd(), 'public');
    const sitemapPath = path.join(publicDir, 'sitemap.xml');

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(sitemapPath, sitemapXML, 'utf8');

    console.log(`✅ Sitemap generated successfully!\n`);
    console.log(`📍 Location: ${sitemapPath}`);
    console.log(`📊 Statistics:`);
    console.log(`   - Platform pages: 5`);
    console.log(`   - Store pages: ${stores?.length || 0}`);
    console.log(`   - Product pages: ${formattedProducts.length}`);
    console.log(`   - Total URLs: ${5 + (stores?.length || 0) + formattedProducts.length}\n`);
    console.log(`🌐 Access at: ${BASE_URL}/sitemap.xml\n`);
    console.log(`💡 Next steps:`);
    console.log(`   1. Submit sitemap to Google Search Console`);
    console.log(`   2. Add to robots.txt: Sitemap: ${BASE_URL}/sitemap.xml`);
    console.log(`   3. Verify with: https://search.google.com/test/rich-results\n`);

  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

main();
