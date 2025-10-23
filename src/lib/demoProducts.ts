// Demo products to seed for new stores
export const DEMO_PRODUCTS = [
  {
    name: "Wireless Headphones",
    description: "Premium wireless headphones with noise cancellation and superior sound quality. Perfect for music lovers and professionals.",
    category: "Electronics",
    base_price: 2999,
    price_range: "₹2,999 - ₹3,499",
    stock: 50,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80"
    ],
    variants: [
      { name: "Black", price: 2999, sku: "WH-BLK" },
      { name: "White", price: 3199, sku: "WH-WHT" },
      { name: "Blue", price: 3499, sku: "WH-BLU" }
    ]
  },
  {
    name: "Smart Watch",
    description: "Feature-rich smartwatch with fitness tracking, heart rate monitor, and notification support. Stay connected on the go.",
    category: "Electronics",
    base_price: 4999,
    price_range: "₹4,999 - ₹5,999",
    stock: 30,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
      "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80"
    ],
    variants: [
      { name: "Black Band", price: 4999, sku: "SW-BLK" },
      { name: "Sport Band", price: 5499, sku: "SW-SPT" },
      { name: "Leather Band", price: 5999, sku: "SW-LTH" }
    ]
  },
  {
    name: "Classic T-Shirt",
    description: "Comfortable cotton t-shirt perfect for everyday wear. Made from premium quality fabric that lasts.",
    category: "Fashion",
    base_price: 599,
    price_range: "₹599 - ₹699",
    stock: 100,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&q=80"
    ],
    variants: [
      { name: "Small", price: 599, sku: "TS-S" },
      { name: "Medium", price: 599, sku: "TS-M" },
      { name: "Large", price: 649, sku: "TS-L" },
      { name: "XL", price: 699, sku: "TS-XL" }
    ]
  },
  {
    name: "Denim Jeans",
    description: "Stylish and durable denim jeans with a perfect fit. Essential wardrobe staple for any occasion.",
    category: "Fashion",
    base_price: 1499,
    price_range: "₹1,499 - ₹1,799",
    stock: 75,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80",
      "https://images.unsplash.com/photo-1475178626620-a4d074967452?w=800&q=80"
    ],
    variants: [
      { name: "30", price: 1499, sku: "DJ-30" },
      { name: "32", price: 1599, sku: "DJ-32" },
      { name: "34", price: 1699, sku: "DJ-34" },
      { name: "36", price: 1799, sku: "DJ-36" }
    ]
  },
  {
    name: "Leather Wallet",
    description: "Genuine leather wallet with multiple card slots and compartments. Sleek design meets functionality.",
    category: "Accessories",
    base_price: 899,
    price_range: "₹899 - ₹1,099",
    stock: 60,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80",
      "https://images.unsplash.com/photo-1608666619878-e5f5c9c6ff04?w=800&q=80"
    ],
    variants: [
      { name: "Brown", price: 899, sku: "LW-BRN" },
      { name: "Black", price: 999, sku: "LW-BLK" },
      { name: "Tan", price: 1099, sku: "LW-TAN" }
    ]
  },
  {
    name: "Sunglasses",
    description: "UV protection sunglasses with polarized lenses. Stylish eyewear for sunny days.",
    category: "Accessories",
    base_price: 1299,
    price_range: "₹1,299 - ₹1,599",
    stock: 45,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80",
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80"
    ],
    variants: [
      { name: "Classic Black", price: 1299, sku: "SG-BLK" },
      { name: "Aviator Gold", price: 1499, sku: "SG-GLD" },
      { name: "Sport Blue", price: 1599, sku: "SG-BLU" }
    ]
  },
  {
    name: "Coffee Maker",
    description: "Automatic coffee maker for perfect brew every time. Start your morning right with fresh coffee.",
    category: "Home & Kitchen",
    base_price: 3499,
    price_range: "₹3,499",
    stock: 25,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80"
    ],
    variants: []
  },
  {
    name: "Yoga Mat",
    description: "Non-slip yoga mat with extra cushioning. Perfect for yoga, pilates, and home workouts.",
    category: "Sports",
    base_price: 799,
    price_range: "₹799 - ₹999",
    stock: 80,
    status: "published",
    images: [
      "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&q=80"
    ],
    variants: [
      { name: "Purple", price: 799, sku: "YM-PUR" },
      { name: "Blue", price: 899, sku: "YM-BLU" },
      { name: "Pink", price: 999, sku: "YM-PNK" }
    ]
  }
];

export const DEMO_CATEGORIES = [
  {
    name: "Electronics",
    image_url: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80"
  },
  {
    name: "Fashion",
    image_url: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=80"
  },
  {
    name: "Accessories",
    image_url: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=400&q=80"
  },
  {
    name: "Home & Kitchen",
    image_url: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&q=80"
  },
  {
    name: "Sports",
    image_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&q=80"
  },
  {
    name: "Beauty",
    image_url: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80"
  }
];
