import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
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

interface ProfileData {
  phone: string | null;
  email: string | null;
}

export const generateStorePDF = async (storeId: string) => {
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

    // Fetch profile data for contact information
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

    // Debug: Log first product to check data integrity
    if (products.length > 0) {
      console.log('Sample product data:', {
        name: products[0].name,
        price: products[0].price_range,
        description: products[0].description
      });
    }

    // Initialize PDF with proper encoding
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      compress: true
    });

    // Set default font to ensure proper character rendering
    pdf.setFont('helvetica', 'normal');

    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 20;

    // Helper function to sanitize and encode text properly
    const sanitizeText = (text: string | null | undefined): string => {
      if (!text) return '';

      let cleanText = text.toString();

      // Decode HTML entities if present
      const textarea = document.createElement('textarea');
      textarea.innerHTML = cleanText;
      cleanText = textarea.value;

      // Remove control characters and non-printable characters
      cleanText = cleanText
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
        .trim();

      // Replace any remaining problematic characters with spaces
      cleanText = cleanText.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

      return cleanText;
    };

    // Add logo if available
    if (store.logo_url) {
      try {
        // Convert logo URL to base64 and add to PDF
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = store.logo_url!;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const logoData = canvas.toDataURL('image/png');

        // Add logo centered at top (max height 30mm)
        const logoHeight = 30;
        const logoWidth = (img.width / img.height) * logoHeight;
        pdf.addImage(logoData, 'PNG', (pageWidth - logoWidth) / 2, yPosition, logoWidth, logoHeight);
        yPosition += logoHeight + 10;
      } catch (error) {
        console.error('Failed to load logo:', error);
        // Continue without logo
      }
    }

    // Store Name (Title)
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(sanitizeText(store.name), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Subtitle
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Store Information for AI Voice Agent', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;

    // Date
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.text(`Generated on: ${currentDate}`, pageWidth / 2, yPosition, { align: 'center' });
    pdf.setTextColor(0);
    yPosition += 15;

    // Helper function to add section headers
    const addSectionHeader = (title: string) => {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(59, 130, 246); // Blue background
      pdf.rect(10, yPosition - 5, pageWidth - 20, 10, 'F');
      pdf.setTextColor(255, 255, 255); // White text
      pdf.text(title, 15, yPosition + 2);
      pdf.setTextColor(0); // Reset to black
      yPosition += 12;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
    };

    // Helper function to add text with wrapping
    const addWrappedText = (label: string, text: string | null) => {
      if (!text) return;

      const cleanText = sanitizeText(text);
      if (!cleanText) return;

      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.text(`${label}:`, 15, yPosition);
      pdf.setFont('helvetica', 'normal');

      const splitText = pdf.splitTextToSize(cleanText, pageWidth - 30);
      pdf.text(splitText, 15, yPosition + 5);
      yPosition += 5 + (splitText.length * 5) + 3;
    };

    // === STORE INFORMATION SECTION ===
    addSectionHeader('Store Information');

    if (store.description) {
      addWrappedText('Description', store.description);
    }

    if (store.address) {
      addWrappedText('Address', store.address);
    }

    if (store.whatsapp_number) {
      addWrappedText('WhatsApp', store.whatsapp_number);
    }

    if (profile?.phone) {
      addWrappedText('Phone', profile.phone);
    }

    if (profile?.email) {
      addWrappedText('Email', profile.email);
    }

    // Social Links
    if (store.social_links) {
      if (store.social_links.facebook) {
        addWrappedText('Facebook', store.social_links.facebook);
      }
      if (store.social_links.instagram) {
        addWrappedText('Instagram', store.social_links.instagram);
      }
      if (store.social_links.twitter) {
        addWrappedText('Twitter', store.social_links.twitter);
      }
    }

    yPosition += 5;

    // === STORE POLICIES SECTION ===
    addSectionHeader('Store Policies');

    if (store.policies?.returnPolicy) {
      addWrappedText('Return Policy', store.policies.returnPolicy);
    }

    if (store.policies?.shippingPolicy) {
      addWrappedText('Shipping Policy', store.policies.shippingPolicy);
    }

    if (store.policies?.termsConditions) {
      addWrappedText('Terms & Conditions', store.policies.termsConditions);
    }

    if (store.policies?.deliveryAreas) {
      addWrappedText('Delivery Areas', store.policies.deliveryAreas);
    }

    yPosition += 5;

    // === PRODUCTS SECTION ===
    addSectionHeader(`Product Catalog (${products.length} Products)`);

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
      Object.entries(productsByCategory).forEach(([category, categoryProducts]) => {
        if (yPosition > 250) {
          pdf.addPage();
          yPosition = 20;
        }

        // Category header
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Category: ${sanitizeText(category)}`, 15, yPosition);
        yPosition += 8;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');

        // Create table for products in this category
        const tableData = categoryProducts.map(product => [
          sanitizeText(product.name),
          sanitizeText(product.price_range) || 'N/A',
          sanitizeText(product.description) || 'No description'
        ]);

        autoTable(pdf, {
          startY: yPosition,
          head: [['Product Name', 'Price', 'Description']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10,
            font: 'helvetica',
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 9,
            font: 'helvetica',
            textColor: 0,
            halign: 'left'
          },
          columnStyles: {
            0: { cellWidth: 50, overflow: 'linebreak' }, // Product Name
            1: { cellWidth: 35, overflow: 'linebreak' }, // Price
            2: { cellWidth: 'auto', overflow: 'linebreak' } // Description
          },
          margin: { left: 15, right: 15 },
          didDrawPage: (data) => {
            yPosition = data.cursor ? data.cursor.y + 10 : yPosition + 10;
          }
        });

        // Update yPosition after table
        const finalY = (pdf as any).lastAutoTable?.finalY || yPosition;
        yPosition = finalY + 10;
      });
    } else {
      pdf.text('No products available.', 15, yPosition);
      yPosition += 10;
    }

    // Add footer to all pages
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `${sanitizeText(store.name)} - Store Information | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Generate filename
    const filename = `${store.slug}-store-info-${new Date().toISOString().split('T')[0]}.pdf`;

    // Save PDF
    pdf.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
