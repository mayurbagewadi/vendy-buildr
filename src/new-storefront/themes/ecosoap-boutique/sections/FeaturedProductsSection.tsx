import { Eye, Filter, HelpCircle, Search, ShoppingBag, Star } from "lucide-react";
import StorefrontImage from "@/components/ui/storefront-image";

type FeaturedProduct = {
  id: string;
  name: string;
  tagline: string;
  noteCategory: string;
  price: number;
  priceLabel: string;
  rating: number;
  image: string;
  skinType: string[];
  source: {
    id: string;
    slug?: string;
    name: string;
  };
};

type FeaturedProductsCopy = {
  productsHeading: string;
  productsSubheading: string;
  emptyProductsTitle: string;
  emptyProductsDescription: string;
};

type FeaturedProductsSectionProps = {
  copy: FeaturedProductsCopy;
  categoryOptions: string[];
  selectedCategory: string;
  searchTerm: string;
  sortBy: string;
  products: FeaturedProduct[];
  onSelectCategory: (category: string) => void;
  onSearchChange: (searchTerm: string) => void;
  onSortChange: (sortBy: string) => void;
  onViewProduct: (product: FeaturedProduct) => void;
  onAddToCart: (product: FeaturedProduct) => void;
};

const FeaturedProductsSection = ({
  copy,
  categoryOptions,
  selectedCategory,
  searchTerm,
  sortBy,
  products,
  onSelectCategory,
  onSearchChange,
  onSortChange,
  onViewProduct,
  onAddToCart,
}: FeaturedProductsSectionProps) => (
  <section className="bg-white py-16" id="ecosoap-products">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="font-serif text-3xl font-semibold text-stone-900 sm:text-4xl">{copy.productsHeading}</h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
          {copy.productsSubheading}
        </p>
      </div>

      <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {categoryOptions.map((category) => (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-normal transition-all sm:text-sm ${
                selectedCategory === category
                  ? "bg-stone-900 text-white shadow"
                  : "border border-stone-200/60 bg-white text-stone-600 hover:text-stone-900"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex max-w-xl grow flex-col gap-3 sm:flex-row lg:justify-end">
          <div className="relative grow">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search ingredients..."
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
              className="w-full cursor-pointer appearance-none rounded-xl border border-stone-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-stone-700 transition-all focus:border-emerald-500 focus:outline-none sm:w-48"
            >
              <option value="recommended">Best Match</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <Filter className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 py-20 text-center">
          <HelpCircle className="mx-auto mb-4 h-12 w-12 text-stone-400" />
          <h3 className="font-serif text-lg font-medium text-stone-800">{copy.emptyProductsTitle}</h3>
          <p className="mt-2 text-sm text-stone-500">{copy.emptyProductsDescription}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <article
              key={product.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white text-left shadow-sm transition-all duration-300 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-50">
                <StorefrontImage
                  src={product.image}
                  alt={product.name}
                  purpose="product-card"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  priority={index < 3}
                />
                <span className="absolute left-4 top-4 rounded-full border border-stone-100/55 bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-800 shadow backdrop-blur-sm">
                  {product.noteCategory} note
                </span>
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-white/10 bg-stone-900/80 px-2.5 py-1.5 text-[10px] font-bold tracking-normal text-white shadow">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{product.rating.toFixed(1)}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-stone-900/70 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onViewProduct(product)}
                    className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-stone-900 shadow-md hover:bg-stone-50"
                  >
                    <Eye className="h-3.5 w-3.5 text-stone-700" />
                    View Recipe
                  </button>
                </div>
              </div>
              <div className="flex grow flex-col justify-between p-6">
                <div>
                  <div className="mb-2.5 flex flex-wrap gap-1">
                    {product.skinType.map((skin) => (
                      <span key={skin} className="rounded-md border border-stone-100 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {skin} Skin
                      </span>
                    ))}
                  </div>
                  <h3 className="font-serif text-lg font-medium text-stone-900 transition-colors group-hover:text-emerald-800 sm:text-xl">
                    {product.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-500 sm:text-sm">{product.tagline}</p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-stone-50 pt-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Price</p>
                    <p className="font-serif text-lg font-semibold text-stone-950">{product.priceLabel}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onViewProduct(product)}
                      className="rounded-xl border border-stone-200/50 bg-stone-50 p-2.5 text-stone-500 transition-all hover:bg-stone-100 hover:text-stone-800 md:hidden"
                      aria-label="View product details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onAddToCart(product)}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 transition-all hover:bg-emerald-600 hover:text-white"
                    >
                      <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                      Add Bar
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  </section>
);

export default FeaturedProductsSection;
