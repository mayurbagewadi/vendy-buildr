import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Package, 
  Eye, 
  Edit,
  Trash2,
  Filter,
  Layers3,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { getProducts, deleteProduct as deleteProductUtil, type Product as SharedProduct } from "@/lib/productData";
import { supabase } from "@/integrations/supabase/client";

type Product = SharedProduct & {
  variantCount?: number;
};

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load products function
  const loadProducts = async () => {
    const loadedProducts = (await getProducts()).map(p => ({
      ...p,
      variantCount: p.variants?.length || 0,
    }));
    setProducts(loadedProducts);
    setFilteredProducts(loadedProducts);
  };

  useEffect(() => {
    // Initial load
    loadProducts();
    
    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'products') {
        loadProducts();
      }
    };
    
    // Reload when window regains focus (catches external changes)
    const handleFocus = () => {
      loadProducts();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    // Filter products based on search term, category, and status
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || product.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
    
    setFilteredProducts(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-success/10 text-success";
      case "draft":
        return "bg-warning/10 text-warning";
      case "inactive":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProductUtil(productId);
    const loadedProducts = (await getProducts()).map(p => ({
      ...p,
      variantCount: p.variants?.length || 0,
    }));
    setProducts(loadedProducts);
    
    toast({
      title: "Product deleted",
      description: "Product removed from catalog",
    });
  };

  const getUniqueCategories = () => {
    const categories = [...new Set(products.map(p => p.category))];
    return categories.sort();
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <AdminLayout>
      <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Products</h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">
              Manage your product catalog
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/admin/products/add")} className="touch-target flex-1 sm:flex-initial">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Product Limit Indicator */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Products Used</span>
                <span className="font-semibold text-foreground">{products.length} / 200</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-success h-2 rounded-full transition-all" 
                  style={{ width: `${Math.min((products.length / 200) * 100, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Total Products</p>
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">
                    {products.length}
                  </p>
                </div>
                <Package className="w-6 h-6 lg:w-8 lg:h-8 text-primary flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Published</p>
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">
                    {products.filter(p => p.status === "published").length}
                  </p>
                </div>
                <Eye className="w-6 h-6 lg:w-8 lg:h-8 text-success flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-muted-foreground truncate">Drafts</p>
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">
                    {products.filter(p => p.status === "draft").length}
                  </p>
                </div>
                <Edit className="w-6 h-6 lg:w-8 lg:h-8 text-warning flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search products by name, SKU, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {getUniqueCategories().map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Product List ({filteredProducts.length})</CardTitle>
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground mb-6">
                  {products.length === 0 
                    ? "Start by adding your first product to your catalog"
                    : "Try adjusting your search criteria"
                  }
                </p>
                {products.length === 0 && (
                  <Button onClick={() => navigate("/admin/products/add")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Product
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[200px]">Product</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead className="hidden md:table-cell">Variants</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="hidden lg:table-cell">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="min-w-[200px]">
                          <div className="flex items-center space-x-2 lg:space-x-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground text-sm lg:text-base truncate">{product.name}</p>
                              <p className="text-xs lg:text-sm text-muted-foreground font-mono truncate">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{product.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center space-x-1.5">
                            <Layers3 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm">
                              {product.variantCount || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-sm whitespace-nowrap">
                          {product.priceRange || (product.basePrice ? formatPrice(product.basePrice) : '—')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge className={getStatusColor(product.status)} variant="outline">
                            {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="View Details"
                              onClick={() => window.open(`/products/${product.id}`, '_blank')}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Edit Product"
                              onClick={() => navigate(`/admin/products/edit/${product.id}`)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                              onClick={() => handleDeleteProduct(product.id)}
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {filteredProducts.length > itemsPerPage && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {generatePageNumbers().map((pageNum) => (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Products;