import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getProducts, getProductStats, getCategories, deleteProduct as deleteProductUtil, type Product as SharedProduct } from "@/lib/productData";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { migrateProductSlugs } from "@/lib/migrateProductSlugs";
import { ProductsImportExport } from "@/components/admin/ProductsImportExport";

type Product = SharedProduct & {
  variantCount?: number;
};

const PAGE_SIZE = 25;

const Products = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const subscriptionLimits = useSubscriptionLimits();

  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [storeSlug, setStoreSlug] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Prevents search useEffect from firing on initial mount
  const hasMounted = useRef(false);

  const toProduct = (p: SharedProduct): Product => ({
    ...p,
    variantCount: p.variants?.length || 0,
  });

  // ─── Initial load ──────────────────────────────────────────────────────────
  const loadInitial = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setLoading(false); return; }

    const { data: store } = await supabase
      .from('stores')
      .select('id, slug')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!store?.id) { setLoading(false); return; }

    setStoreSlug(store.slug || '');
    setStoreId(store.id);

    // Run slug migration only once per store (not on every page visit)
    const migrationKey = `slug_migrated_${store.id}`;
    if (!localStorage.getItem(migrationKey)) {
      await migrateProductSlugs(store.id);
      localStorage.setItem(migrationKey, '1');
    }

    // Stats + first page + categories — all in parallel, one round-trip each
    const [statsData, firstPage, cats] = await Promise.all([
      getProductStats(store.id),
      getProducts({ page: 1, limit: PAGE_SIZE, storeId: store.id }),
      getCategories(store.id),
    ]);

    setStats(statsData);
    setProducts(firstPage.map(toProduct));
    setHasMore(firstPage.length === PAGE_SIZE);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => {
    loadInitial();
  }, []);

  // ─── Highlight new product after add ──────────────────────────────────────
  useEffect(() => {
    const state = location.state as { highlightedProductId?: string };
    if (!state?.highlightedProductId) return;

    setHighlightedProductId(state.highlightedProductId);

    let attempts = 0;
    const scrollInterval = setInterval(() => {
      const row = document.querySelector(`[data-product-id="${state.highlightedProductId}"]`);
      if (row || attempts >= 10) {
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clearInterval(scrollInterval);
      }
      attempts++;
    }, 200);

    setTimeout(() => setHighlightedProductId(null), 3500);
    window.history.replaceState({}, document.title);
  }, [location, products]);

  // ─── Debounced server-side search & filter ────────────────────────────────
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const timer = setTimeout(async () => {
      if (!storeId) return;
      setIsSearching(true);

      const isFiltered = searchTerm || categoryFilter !== 'all' || statusFilter !== 'all';

      if (isFiltered) {
        const results = await getProducts({
          storeId,
          search: searchTerm || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        });
        setProducts(results.map(toProduct));
        setHasMore(false);
      } else {
        // No filters — back to paginated first page
        const firstPage = await getProducts({ storeId, page: 1, limit: PAGE_SIZE });
        setProducts(firstPage.map(toProduct));
        setHasMore(firstPage.length === PAGE_SIZE);
        setPage(1);
      }

      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, categoryFilter, statusFilter, storeId]);

  // ─── Load more ────────────────────────────────────────────────────────────
  const handleLoadMore = async () => {
    if (!storeId) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const more = await getProducts({ storeId, page: nextPage, limit: PAGE_SIZE });
    setProducts(prev => [...prev, ...more.map(toProduct)]);
    setHasMore(more.length === PAGE_SIZE);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  // ─── Delete — optimistic (instant UI, rollback on error) ──────────────────
  const handleDeleteProduct = async (productId: string) => {
    const removed = products.find(p => p.id === productId);

    // Remove from list immediately — no waiting for API
    setProducts(prev => prev.filter(p => p.id !== productId));
    if (removed) {
      setStats(prev => ({
        total: prev.total - 1,
        published: removed.status === 'published' ? prev.published - 1 : prev.published,
        draft: removed.status === 'draft' ? prev.draft - 1 : prev.draft,
      }));
    }

    try {
      await deleteProductUtil(productId);
      localStorage.setItem('products_need_export', 'true');
      window.dispatchEvent(new Event('productChanged'));
      toast({ title: "Product deleted", description: "Product removed from catalog" });
    } catch {
      // Rollback on failure
      if (removed) {
        setProducts(prev => [removed, ...prev]);
        setStats(prev => ({
          total: prev.total + 1,
          published: removed.status === 'published' ? prev.published + 1 : prev.published,
          draft: removed.status === 'draft' ? prev.draft + 1 : prev.draft,
        }));
      }
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-success/10 text-success";
      case "draft": return "bg-warning/10 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);

  const isFiltering = !!(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all');

  return (
    <>
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
            <ProductsImportExport onImportComplete={loadInitial} />
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
                <span className="font-semibold text-foreground">
                  {stats.total} / {subscriptionLimits.maxProducts || '∞'}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-success h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((stats.total / (subscriptionLimits.maxProducts || stats.total || 1)) * 100, 100)}%` }}
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
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">{stats.total}</p>
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
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">{stats.published}</p>
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
                  <p className="text-xl lg:text-2xl font-bold text-foreground mt-1 lg:mt-2">{stats.draft}</p>
                </div>
                <Edit className="w-6 h-6 lg:w-8 lg:h-8 text-warning flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="border-primary">
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 animate-spin" />
                )}
                <Input
                  placeholder="Search by name, SKU, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-primary"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] border-primary">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] border-primary">
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
              <CardTitle>
                {isFiltering
                  ? `${products.length} result${products.length !== 1 ? 's' : ''}`
                  : `Product List (${stats.total} total)`
                }
              </CardTitle>
              {!isFiltering && stats.total > PAGE_SIZE && (
                <div className="text-sm text-muted-foreground">
                  Showing {products.length} of {stats.total}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
                <p className="text-muted-foreground mb-6">
                  {stats.total === 0
                    ? "Start by adding your first product to your catalog"
                    : "Try adjusting your search criteria"
                  }
                </p>
                {stats.total === 0 && (
                  <Button onClick={() => navigate("/admin/products/add")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Product
                  </Button>
                )}
              </div>
            ) : (
              <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    data-product-id={product.id}
                    className={`rounded-xl border border-border bg-card p-4 space-y-3 transition-all duration-500 border-l-4 border-l-primary ${
                      highlightedProductId === product.id
                        ? 'border-success border-l-success bg-success/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{product.sku}</p>
                      </div>
                      <span className="font-bold text-sm text-foreground whitespace-nowrap">
                        {product.priceRange || (product.basePrice ? formatPrice(product.basePrice) : '—')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                      <Badge className={`${getStatusColor(product.status)} text-xs ml-auto`} variant="outline">
                        {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0 border-primary"
                        title="View in Store"
                        onClick={() => {
                          const url = storeSlug
                            ? `/${storeSlug}/products/${product.slug || product.id}`
                            : `/products/${product.slug || product.id}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 flex-1 gap-2 border-primary"
                        onClick={() => navigate(`/admin/products/edit/${product.id}`)}
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => setProductToDelete(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[150px]">Product</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead className="hidden md:table-cell">Variants</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="hidden lg:table-cell">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow
                        key={product.id}
                        data-product-id={product.id}
                        className={`hover:bg-muted/50 transition-all duration-500 cursor-pointer ${
                          highlightedProductId === product.id
                            ? 'bg-success/10 border-l-4 border-success animate-in fade-in'
                            : ''
                        }`}
                        onClick={() => navigate(`/admin/products/edit/${product.id}`)}
                      >
                        <TableCell className="min-w-[150px]">
                          <div className="flex items-center space-x-2 lg:space-x-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground text-sm lg:text-base truncate">{product.name}</p>
                              <p className="text-xs lg:text-sm text-muted-foreground font-mono truncate">{product.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{product.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center space-x-1.5">
                            <Layers3 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium text-sm">{product.variantCount || 0}</span>
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
                              title="View in Store"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = storeSlug
                                  ? `/${storeSlug}/products/${product.slug || product.id}`
                                  : `/products/${product.slug || product.id}`;
                                window.open(url, '_blank');
                              }}
                              className="h-10 w-10 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit Product"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/admin/products/edit/${product.id}`);
                              }}
                              className="h-10 w-10 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductToDelete(product.id);
                              }}
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

              {/* Load More — only shown when not filtering and more pages exist */}
              {!isFiltering && hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="min-w-[160px]"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load More (${stats.total - products.length} remaining)`
                    )}
                  </Button>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => { if (!open) setProductToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (productToDelete) {
                  handleDeleteProduct(productToDelete);
                  setProductToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Products;
