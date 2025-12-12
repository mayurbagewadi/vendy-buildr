import { supabase } from '@/integrations/supabase/client';

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  whatsapp_number: string | null;
  address: string | null;
  social_links: {
    facebook?: string | null;
    instagram?: string | null;
    twitter?: string | null;
  } | null;
  policies: {
    returnPolicy?: string | null;
    shippingPolicy?: string | null;
    termsConditions?: string | null;
    deliveryAreas?: string | null;
  } | null;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price_range?: string;
  description?: string;
  status: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  size?: string;
  color?: string;
  price: number;
  stock_quantity: number;
}

interface ProfileData {
  phone: string | null;
  email: string | null;
}

export const generateStoreTXT = async (storeId: string) => {
  try {
    // Fetch store data
    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (storeError) throw storeError;
    if (!storeData) throw new Error('Store not found');

    const store = storeData as unknown as StoreData;

    // Fetch profile data
    const { data: profileData } = await supabase
      .from('profiles')
      .select('phone, email')
      .eq('user_id', storeData.user_id)
      .maybeSingle();

    const profile = profileData as ProfileData | null;

    // Fetch all published products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, category, price_range, description, status')
      .eq('store_id', storeId)
      .eq('status', 'published')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (productsError) throw productsError;

    const products = (productsData || []) as Product[];

    // Fetch all product variants
    const productIds = products.map(p => p.id);
    let variants: ProductVariant[] = [];

    if (productIds.length > 0) {
      const { data: variantsData, error: variantsError } = await (supabase as any)
        .from('product_variants')
        .select('id, product_id, size, color, price, stock_quantity')
        .in('product_id', productIds)
        .order('price', { ascending: true });

      if (!variantsError && variantsData) {
        variants = variantsData as unknown as ProductVariant[];
      }
    }

    // Build TXT content
    let txtContent = '';

    // Header
    txtContent += '='.repeat(80) + '\n';
    txtContent += `${store.name.toUpperCase()}\n`;
    txtContent += 'STORE INFORMATION FOR AI VOICE AGENT\n';
    txtContent += `Generated on: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}\n`;
    txtContent += '='.repeat(80) + '\n\n';

    // Store Information Section
    txtContent += '-'.repeat(80) + '\n';
    txtContent += 'STORE INFORMATION\n';
    txtContent += '-'.repeat(80) + '\n\n';

    txtContent += `Store Name: ${store.name}\n`;

    if (store.description) {
      txtContent += `\nDescription:\n${store.description}\n`;
    }

    if (store.address) {
      txtContent += `\nAddress:\n${store.address}\n`;
    }

    if (store.whatsapp_number) {
      txtContent += `\nWhatsApp: ${store.whatsapp_number}\n`;
    }

    if (profile?.phone) {
      txtContent += `Phone: ${profile.phone}\n`;
    }

    if (profile?.email) {
      txtContent += `Email: ${profile.email}\n`;
    }

    // Social Media
    if (store.social_links) {
      txtContent += `\nSocial Media:\n`;
      if (store.social_links.facebook) {
        txtContent += `  Facebook: ${store.social_links.facebook}\n`;
      }
      if (store.social_links.instagram) {
        txtContent += `  Instagram: ${store.social_links.instagram}\n`;
      }
      if (store.social_links.twitter) {
        txtContent += `  Twitter: ${store.social_links.twitter}\n`;
      }
    }

    txtContent += '\n';

    // Store Policies Section
    txtContent += '-'.repeat(80) + '\n';
    txtContent += 'STORE POLICIES\n';
    txtContent += '-'.repeat(80) + '\n\n';

    if (store.policies?.deliveryAreas) {
      txtContent += `Delivery Areas:\n${store.policies.deliveryAreas}\n\n`;
    }

    if (store.policies?.returnPolicy) {
      txtContent += `Return Policy:\n${store.policies.returnPolicy}\n\n`;
    }

    if (store.policies?.shippingPolicy) {
      txtContent += `Shipping Policy:\n${store.policies.shippingPolicy}\n\n`;
    }

    if (store.policies?.termsConditions) {
      txtContent += `Terms & Conditions:\n${store.policies.termsConditions}\n\n`;
    }

    // Products Section
    txtContent += '-'.repeat(80) + '\n';
    txtContent += `PRODUCT CATALOG (${products.length} Products)\n`;
    txtContent += '-'.repeat(80) + '\n\n';

    if (products.length > 0) {
      // Group products by category
      const productsByCategory = products.reduce((acc, product) => {
        const category = product.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(product);
        return acc;
      }, {} as Record<string, Product[]>);

      // Add products by category
      Object.entries(productsByCategory).forEach(([category, categoryProducts], categoryIndex) => {
        if (categoryIndex > 0) {
          txtContent += '\n';
        }

        txtContent += `\n${'='.repeat(80)}\n`;
        txtContent += `CATEGORY: ${category.toUpperCase()}\n`;
        txtContent += `${'='.repeat(80)}\n\n`;

        categoryProducts.forEach((product, index) => {
          txtContent += `${index + 1}. ${product.name}\n`;

          if (product.price_range) {
            txtContent += `   Price: ${product.price_range}\n`;
          }

          if (product.description) {
            txtContent += `   Description: ${product.description}\n`;
          }

          // Add variants for this product
          const productVariants = variants.filter(v => v.product_id === product.id);
          if (productVariants.length > 0) {
            txtContent += `   Available Variants:\n`;
            productVariants.forEach((variant, vIndex) => {
              let variantText = `     ${vIndex + 1}) `;
              const variantDetails = [];

              if (variant.size) variantDetails.push(`Size: ${variant.size}`);
              if (variant.color) variantDetails.push(`Color: ${variant.color}`);
              variantDetails.push(`Price: Rs ${variant.price}`);
              variantDetails.push(`Stock: ${variant.stock_quantity}`);

              variantText += variantDetails.join(', ');
              txtContent += variantText + '\n';
            });
          }

          txtContent += '\n';
        });
      });
    } else {
      txtContent += 'No products available.\n\n';
    }

    // Footer
    txtContent += '\n' + '='.repeat(80) + '\n';
    txtContent += 'END OF STORE INFORMATION\n';
    txtContent += '='.repeat(80) + '\n';

    // Create and download TXT file
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${store.slug}-store-info-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename: link.download };
  } catch (error) {
    console.error('Error generating TXT:', error);
    throw error;
  }
};
