import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/customer/Header";
import Footer from "@/components/customer/Footer";
import ProductCard from "@/components/customer/ProductCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Package } from "lucide-react";
import { initializeProducts } from "@/lib/productData";

interface Product {
  id: string;
  name: string;
  category: string;
  priceRange: string;
  images: string[];
  status: string;
  createdAt: string;
}

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    // Initialize products with seed data if empty
    initializeProducts();
    
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    const publishedProducts = products.filter((p: Product) => p.status === "published");
    
    // Featured products (first 4)
    setFeaturedProducts(publishedProducts.slice(0, 4));
    
    // New arrivals (last 4)
    const sorted = [...publishedProducts].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setNewArrivals(sorted.slice(0, 4));
    
    // Unique categories
    const uniqueCategories = [...new Set(publishedProducts.map((p: Product) => p.category))] as string[];
    setCategories(uniqueCategories);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-background py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                Welcome to MyStore
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Discover quality products at unbeatable prices. Shop now!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/products">
                  <Button size="lg" className="w-full sm:w-auto">
                    Shop Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/products">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Browse Categories
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>


        {/* Featured Products */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Featured Products</h2>
                <p className="text-muted-foreground">Check out our top picks for you</p>
              </div>
              <Link to="/products">
                <Button variant="outline">
                  View All
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-12">No products available yet.</p>
            )}
          </div>
        </section>

        {/* Categories */}
        {categories.length > 0 && (
          <section id="categories" className="py-16 bg-muted/50">
            <div className="container mx-auto px-4">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Shop by Category</h2>
                <p className="text-muted-foreground">Browse our wide range of categories</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {categories.map((category) => (
                  <Link key={category} to={`/products?category=${encodeURIComponent(category)}`}>
                    <Card className="px-6 py-3 hover:shadow-lg transition-shadow cursor-pointer whitespace-nowrap min-w-fit">
                      <h3 className="font-semibold text-foreground">{category}</h3>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">New Arrivals</h2>
                <p className="text-muted-foreground">Fresh products just for you</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {newArrivals.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Shopping?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Explore thousands of products and great deals
            </p>
            <Link to="/products">
              <Button size="lg" variant="secondary">
                Browse Products
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;
