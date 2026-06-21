import { Link } from "react-router-dom";
import {
  CheckCircle,
  ChevronRight,
  Heart,
  Leaf,
  Minus,
  Plus,
  Scale,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

import ProductCard from "@/components/customer/ProductCard";
import StoreFooter from "@/components/customer/StoreFooter";
import { SEOHead } from "@/components/seo/SEOHead";
import LazyImage from "@/components/ui/lazy-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateProductImageAlt } from "@/lib/seo/altTags";
import { getProductCanonicalUrl } from "@/lib/seo/canonicalUrl";
import type { ThemeProductDetailProps } from "@/new-storefront/theme-engine/types";

const EcoSoapProductDetail = ({
  store,
  profile,
  storeSlug,
  isSubdomain,
  product,
  relatedProducts,
  currentVariant,
  selectedVariant,
  setSelectedVariant,
  quantity,
  selectedImage,
  setSelectedImage,
  showConfirmationModal,
  setShowConfirmationModal,
  isDescriptionExpanded,
  setIsDescriptionExpanded,
  images,
  videoUrl,
  videoThumbnail,
  baseSku,
  hasVariants,
  needsVariantSelection,
  currentPrice,
  availableStock,
  isOutOfStock,
  stockLabel,
  isSeoAvailable,
  shouldCollapseDescription,
  shouldShowDescriptionToggle,
  mainImageRef,
  variantSectionRef,
  descriptionRef,
  links,
  handleQuantityChange,
  handleAddToCart,
  handleShare,
}: ThemeProductDetailProps) => {
  const storeAny = store as any;
  const profileAny = profile as any;

  const ecoBenefits = [
    product.category ? `${product.category} formulation` : "Botanical formulation",
    isOutOfStock ? "Currently curing" : "Ready to dispatch",
    hasVariants ? "Multiple batch options" : "Single curated batch",
  ];

  const ecoIngredients = [
    product.category || "Botanical blend",
    "Cold process oils",
    currentVariant?.name || "Natural extract",
    baseSku ? `Batch ${baseSku}` : "Small-batch craft",
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#fbfaf6] text-stone-900">
      <SEOHead
        title={`${product.name} - ${storeAny?.name || "Store"} | Buy Online`}
        description={product.description?.slice(0, 160) || `Shop ${product.name} from ${storeAny?.name}. ${currentVariant ? `Price: Rs. ${currentVariant.price}` : product.base_price ? `Starting from Rs. ${product.base_price}` : ""}`}
        canonical={getProductCanonicalUrl(
          storeSlug || "",
          product.id,
          storeAny?.subdomain,
          storeAny?.custom_domain
        )}
        image={images[0]}
        type="product"
        price={currentVariant?.price || product.base_price}
        availability={isSeoAvailable ? "in stock" : "out of stock"}
        keywords={[product.name, product.category, storeAny?.name || "store", "buy online"]}
      />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8 md:pb-10">
        <nav className="mb-8 flex items-center gap-2 text-sm text-stone-500">
          <Link to={links.home} className="hover:text-emerald-700">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to={links.products} className="hover:text-emerald-700">Botanicals</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="line-clamp-1 text-stone-800">{product.name}</span>
        </nav>

        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <div className="sticky top-28 space-y-4">
              <div className="overflow-hidden rounded-2xl border-4 border-white bg-stone-50 shadow-2xl">
                <div className="aspect-[4/3]">
                  {selectedImage < images.length ? (
                    <img
                      ref={mainImageRef}
                      src={images[selectedImage]}
                      alt={generateProductImageAlt({
                        productName: product.name,
                        category: product.category,
                        imageIndex: selectedImage,
                      })}
                      className="h-full w-full object-cover"
                      loading="eager"
                      decoding="async"
                    />
                  ) : (
                    <div className="relative h-full w-full bg-stone-100">
                      <iframe
                        className="absolute inset-0 h-full w-full"
                        src={`https://www.youtube.com/embed/${videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] || videoUrl}`}
                        title="Product Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              </div>

              {(images.length > 1 || videoUrl) && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={image + index}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-square overflow-hidden rounded-xl border-2 bg-white transition-all ${
                        selectedImage === index ? "border-emerald-600 shadow" : "border-stone-100 hover:border-emerald-200"
                      }`}
                      aria-label={`View image ${index + 1}`}
                    >
                      <LazyImage
                        src={image}
                        alt={generateProductImageAlt({
                          productName: product.name,
                          category: product.category,
                          imageIndex: index,
                        })}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                  {videoUrl && videoThumbnail && (
                    <button
                      onClick={() => setSelectedImage(images.length)}
                      className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-white transition-all ${
                        selectedImage === images.length ? "border-emerald-600 shadow" : "border-stone-100 hover:border-emerald-200"
                      }`}
                      aria-label="View product video"
                    >
                      <img src={videoThumbnail} alt={`${product.name} video`} className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-stone-900/35 text-white">Play</span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    Eco Score
                  </p>
                  <p className="mt-1 font-serif text-xl font-semibold text-stone-900">96% Pure</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                    <Scale className="h-3.5 w-3.5" />
                    Dispatch
                  </p>
                  <p className="mt-1 font-serif text-xl font-semibold text-stone-900">{stockLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-stone-100 bg-white p-6 text-left shadow-sm sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  {product.category || "botanical"} note profile
                </span>
                {isOutOfStock && (
                  <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-700">
                    Out of stock
                  </span>
                )}
              </div>

              <h1 className="font-serif text-3xl font-medium leading-tight text-stone-950 sm:text-4xl lg:text-5xl">
                {product.name}
              </h1>

              <div className="mt-5 border-y border-stone-100 py-5">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Batch Price</p>
                <div className="mt-2">
                  {needsVariantSelection ? (
                    <p className="font-serif text-3xl font-semibold text-stone-400">Select a batch</p>
                  ) : (
                    <p className="font-serif text-4xl font-semibold text-emerald-700">
                      Rs. {(currentPrice * quantity).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-stone-900">
                  The Heritage Story
                </h2>
                <div className="relative mt-3">
                  <p
                    ref={descriptionRef}
                    className={`whitespace-pre-wrap text-sm leading-relaxed text-stone-600 ${
                      shouldCollapseDescription ? "max-h-24 overflow-hidden" : ""
                    }`}
                  >
                    {product.description || "A carefully prepared botanical product made for a premium handmade storefront experience."}
                  </p>
                  {shouldCollapseDescription && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
                  )}
                </div>
                {shouldShowDescriptionToggle && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
                    className="mt-2 text-sm font-semibold text-emerald-700 hover:underline"
                  >
                    {isDescriptionExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                  <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-stone-900">
                    Botanical Formula
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-stone-600">
                    {ecoIngredients.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                  <h3 className="font-serif text-sm font-bold uppercase tracking-wider text-stone-900">
                    Skin Values
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ecoBenefits.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700">
                        <Heart className="h-3 w-3 text-emerald-600" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {hasVariants && (
                <div ref={variantSectionRef} className={`mt-6 rounded-2xl border p-5 ${!selectedVariant ? "border-amber-200 bg-amber-50/50" : "border-emerald-100 bg-emerald-50/40"}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <Label className="font-serif text-base font-semibold text-stone-900">
                      Select Cured Batch {!selectedVariant && <span className="text-red-600">*</span>}
                    </Label>
                    {!selectedVariant && <span className="text-xs font-semibold text-amber-700">Required</span>}
                  </div>
                  <RadioGroup value={selectedVariant} onValueChange={setSelectedVariant}>
                    <div className="space-y-3">
                      {product.variants?.map((variant) => {
                        const variantOutOfStock = variant.stock === 0;
                        return (
                          <button
                            key={variant.name}
                            type="button"
                            disabled={variantOutOfStock}
                            onClick={() => !variantOutOfStock && setSelectedVariant(variant.name)}
                            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                              selectedVariant === variant.name
                                ? "border-emerald-600 bg-white shadow-sm"
                                : "border-stone-200 bg-white hover:border-emerald-200"
                            } ${variantOutOfStock ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            <RadioGroupItem value={variant.name} id={variant.name} disabled={variantOutOfStock} />
                            <span className="flex-1">
                              <span className="block font-medium text-stone-900">{variant.name}</span>
                              {variantOutOfStock && <span className="text-xs text-red-600">Out of stock</span>}
                            </span>
                            <span className="font-serif text-lg font-semibold text-emerald-700">
                              Rs. {(variant.offer_price && variant.offer_price > 0 && variant.offer_price < variant.price ? variant.offer_price : variant.price).toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="mt-6">
                <Label className="mb-3 block font-serif text-base font-semibold text-stone-900">Quantity</Label>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex w-fit items-center rounded-full border border-stone-200 bg-white">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px] rounded-full"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1 || needsVariantSelection || isOutOfStock}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="w-16 text-center text-lg font-semibold">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px] rounded-full"
                      onClick={() => handleQuantityChange(1)}
                      disabled={needsVariantSelection || isOutOfStock || (availableStock !== null && quantity >= availableStock)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="text-sm text-stone-500">
                    Availability: <span className={isOutOfStock ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{stockLabel}</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleAddToCart}
                  size="lg"
                  className="min-h-[52px] w-full rounded-full bg-stone-900 text-white hover:bg-emerald-800"
                  disabled={isOutOfStock}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  {isOutOfStock ? "Out of Stock" : "Add This Bar To Cart"}
                </Button>
                <Button onClick={handleShare} variant="outline" className="min-h-[48px] w-full rounded-full border-stone-200">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Product
                </Button>
              </div>

              <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  Green Assurance
                </p>
                <p className="mt-2 text-xs leading-relaxed text-emerald-950">
                  Packed with the same commerce engine, stock checks, and secure checkout flow while presenting the EcoSoap Boutique experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="mt-16 border-t border-stone-100 pt-12">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">More from the saponary</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-stone-900">Related Botanicals</h2>
              </div>
              <Leaf className="hidden h-8 w-8 text-emerald-600 sm:block" />
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  id={relatedProduct.id}
                  slug={(relatedProduct as any).slug}
                  name={relatedProduct.name}
                  category={relatedProduct.category}
                  priceRange={relatedProduct.price_range}
                  base_price={relatedProduct.base_price}
                  offer_price={relatedProduct.offer_price}
                  variants={(relatedProduct as any).variants}
                  stock={(relatedProduct as any).stock}
                  images={relatedProduct.images}
                  status={relatedProduct.status}
                  storeSlug={isSubdomain ? undefined : storeSlug}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-100 bg-white/95 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-stone-500">{needsVariantSelection ? "Select batch" : selectedVariant || product.name}</p>
            <p className="font-serif text-lg font-semibold text-emerald-700">
              {needsVariantSelection ? "Rs. --" : `Rs. ${(currentPrice * quantity).toFixed(2)}`}
            </p>
          </div>
          <Button
            onClick={handleAddToCart}
            size="lg"
            className="min-h-[48px] rounded-full bg-stone-900 px-6 font-semibold text-white hover:bg-emerald-800"
            disabled={isOutOfStock}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {showConfirmationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-900/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowConfirmationModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-stone-100 bg-white p-6 shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex gap-4 border-b border-stone-100 pb-4">
              <img src={images[0]} alt={product.name} className="h-16 w-16 rounded-xl object-cover" loading="lazy" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-serif text-lg font-semibold text-stone-900">{product.name}</h3>
                {selectedVariant && <p className="text-sm text-stone-500">Batch: {selectedVariant}</p>}
                <p className="text-sm font-semibold text-emerald-700">Rs. {currentPrice} x {quantity}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-5 text-emerald-700">
              <CheckCircle className="h-7 w-7" />
              <span className="font-semibold">Added to your EcoSoap basket</span>
            </div>
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setShowConfirmationModal(false);
                  window.location.href = links.cart;
                }}
                className="min-h-[48px] w-full rounded-full bg-stone-900 text-white hover:bg-emerald-800"
              >
                View Cart
              </Button>
              <Button onClick={() => setShowConfirmationModal(false)} variant="outline" className="min-h-[48px] w-full rounded-full">
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      )}

      {storeAny ? (
        <StoreFooter
          storeName={storeAny.name}
          storeDescription={storeAny.description}
          whatsappNumber={storeAny.whatsapp_number}
          phone={profileAny?.phone}
          email={profileAny?.email}
          address={storeAny.address}
          facebookUrl={storeAny.facebook_url}
          instagramUrl={storeAny.instagram_url}
          twitterUrl={storeAny.twitter_url}
          youtubeUrl={storeAny.youtube_url}
          linkedinUrl={storeAny.linkedin_url}
          socialLinks={storeAny.social_links}
          policies={storeAny.policies}
        />
      ) : null}
    </div>
  );
};

export default EcoSoapProductDetail;
