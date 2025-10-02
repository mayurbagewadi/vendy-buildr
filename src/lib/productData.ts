// Shared product data utility for admin and customer sections

export interface Variant {
  name: string;
  price: number;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice?: number;
  priceRange?: string;
  stock?: number;
  sku?: string;
  status: 'published' | 'draft' | 'inactive';
  images: string[];
  variants?: Variant[];
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'products';

// Seed data for demo purposes
const seedProducts: Product[] = [
  {
    id: '1',
    name: 'Premium Organic Coffee Beans',
    description: 'High-quality organic coffee beans sourced from sustainable farms. Perfect for espresso and drip coffee.',
    category: 'Beverages',
    status: 'published',
    images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800'],
    variants: [
      { name: '250g', price: 299, sku: 'COF-250' },
      { name: '500g', price: 549, sku: 'COF-500' },
      { name: '1kg', price: 999, sku: 'COF-1KG' }
    ],
    priceRange: '₹299 - ₹999',
    stock: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Artisan Sourdough Bread',
    description: 'Handcrafted sourdough bread made with traditional techniques and natural ingredients.',
    category: 'Bakery',
    status: 'published',
    images: ['https://images.unsplash.com/photo-1549931319-a545dcf3bc4c?w=800'],
    basePrice: 150,
    priceRange: '₹150',
    stock: 30,
    sku: 'BRD-SRD-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Fresh Organic Vegetables Mix',
    description: 'A curated mix of fresh, organic vegetables delivered directly from local farms.',
    category: 'Groceries',
    status: 'published',
    images: ['https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800'],
    variants: [
      { name: '1kg Pack', price: 199, sku: 'VEG-1KG' },
      { name: '3kg Pack', price: 549, sku: 'VEG-3KG' },
      { name: '5kg Pack', price: 849, sku: 'VEG-5KG' }
    ],
    priceRange: '₹199 - ₹849',
    stock: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Premium Extra Virgin Olive Oil',
    description: 'Cold-pressed extra virgin olive oil from Mediterranean groves. Perfect for cooking and salads.',
    category: 'Groceries',
    status: 'published',
    images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800'],
    variants: [
      { name: '250ml', price: 399, sku: 'OIL-250' },
      { name: '500ml', price: 749, sku: 'OIL-500' },
      { name: '1L', price: 1399, sku: 'OIL-1L' }
    ],
    priceRange: '₹399 - ₹1,399',
    stock: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '5',
    name: 'Handmade Dark Chocolate Bar',
    description: 'Rich 70% dark chocolate made with premium cocoa beans. No artificial additives.',
    category: 'Beverages',
    status: 'published',
    images: ['https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=800'],
    basePrice: 250,
    priceRange: '₹250',
    stock: 60,
    sku: 'CHC-DRK-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '6',
    name: 'Organic Green Tea Collection',
    description: 'Premium green tea collection with jasmine, mint, and classic varieties.',
    category: 'Beverages',
    status: 'published',
    images: ['https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800'],
    variants: [
      { name: '25 Tea Bags', price: 299, sku: 'TEA-25' },
      { name: '50 Tea Bags', price: 549, sku: 'TEA-50' },
      { name: '100 Tea Bags', price: 999, sku: 'TEA-100' }
    ],
    priceRange: '₹299 - ₹999',
    stock: 75,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Initialize products with seed data if none exist
export const initializeProducts = (): void => {
  const existingProducts = localStorage.getItem(STORAGE_KEY);
  if (!existingProducts || JSON.parse(existingProducts).length === 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedProducts));
  }
};

// Get all products
export const getProducts = (): Product[] => {
  const products = localStorage.getItem(STORAGE_KEY);
  return products ? JSON.parse(products) : [];
};

// Get published products (for customer view)
export const getPublishedProducts = (): Product[] => {
  return getProducts().filter(p => p.status === 'published');
};

// Get product by ID
export const getProductById = (id: string): Product | null => {
  const products = getProducts();
  return products.find(p => p.id === id) || null;
};

// Save products
export const saveProducts = (products: Product[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
};

// Add product
export const addProduct = (product: Product): void => {
  const products = getProducts();
  products.push(product);
  saveProducts(products);
};

// Update product
export const updateProduct = (id: string, updatedProduct: Product): void => {
  const products = getProducts();
  const index = products.findIndex(p => p.id === id);
  if (index !== -1) {
    products[index] = updatedProduct;
    saveProducts(products);
  }
};

// Delete product
export const deleteProduct = (id: string): void => {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
};

// Get unique categories
export const getCategories = (): string[] => {
  const products = getProducts();
  const categories = products.map(p => p.category);
  return Array.from(new Set(categories)).filter(Boolean);
};
