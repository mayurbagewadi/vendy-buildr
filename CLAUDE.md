# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vendy-Buildr is a multi-tenant e-commerce platform built with React, TypeScript, and Vite. It supports multiple store types: admin dashboards (store owners), customer-facing storefronts, helper/referral system, and super-admin management. The platform uses Supabase for backend services and supports both subdomain-based (store.yesgive.shop) and path-based (yesgive.shop/store) routing.

## Development Commands

### Setup & Running
```bash
npm install                          # Install dependencies
npm run dev                          # Start dev server (localhost:8080)
npm run build                        # Production build
npm run build:dev                    # Development build
npm run lint                         # Run ESLint on all files
npm run preview                      # Preview production build locally
npm run submit-sitemaps             # Submit sitemaps to search engines
```

## Architecture & Code Structure

### Core Technology Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router v6
- **State Management**: Context API (CartContext), TanStack React Query for server state
- **UI Components**: shadcn-ui + Radix UI primitives
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod validation
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Theming**: next-themes (light/dark mode)

### Directory Structure

```
src/
├── pages/                    # Route-level pages
│   ├── admin/               # Store admin dashboard pages (protected by StoreGuard)
│   ├── superadmin/          # Platform super-admin pages (protected by SuperAdminGuard)
│   ├── customer/            # Customer-facing store pages
│   ├── onboarding/          # Store setup and integration onboarding
│   ├── Auth.tsx             # Store owner authentication
│   ├── HelperLogin.tsx      # Helper/referral login
│   ├── Index.tsx            # Platform landing page (yesgive.shop)
│   ├── Pricing.tsx          # Pricing page
│   └── ...other pages
├── components/
│   ├── ui/                  # shadcn-ui components (button, card, dialog, etc.)
│   ├── admin/               # Admin dashboard components (AdminLayout, EditOrderModal, etc.)
│   ├── superadmin/          # Super admin components (guards, feature management)
│   ├── customer/            # Customer-facing components (HeroBannerCarousel, MiniCart, etc.)
│   ├── seo/                 # SEO-related components (StructuredData, SEOImage)
│   └── ScrollToTop.tsx      # Scroll restoration component
├── contexts/                # React Context providers
│   └── CartContext.tsx      # Shopping cart state management
├── hooks/                   # Custom React hooks
│   ├── use-toast.ts         # Toast notification hook
│   └── useLandingAnimations.ts
├── lib/                     # Utility functions and helpers
│   ├── domainUtils.ts       # Domain detection (subdomain vs path-based routing)
│   ├── cartUtils.ts         # Cart operations
│   ├── productData.ts       # Product service layer
│   ├── demoProducts.ts      # Demo/placeholder products
│   ├── shiprocket.ts        # Shipping integration
│   ├── imageUtils.ts        # Image optimization
│   ├── generateStorePDF.ts  # PDF export functionality
│   ├── generateStoreTXT.ts  # Text export functionality
│   ├── dataValidation.ts    # Form/data validation schemas
│   ├── platformSettings.ts  # Global settings management
│   └── ...other utilities
├── App.tsx                  # Root routing component (domain-aware routing logic)
├── main.tsx                 # React DOM entry point
└── index.css                # Global styles
```

### Critical Architectural Patterns

#### 1. Multi-Tenant Routing (Domain Detection)
The app detects two contexts:
- **Store-specific (Subdomain/Custom Domain)**: `store.yesgive.shop` or custom domain
  - Routes use `/admin/...`, `/products`, `/cart` (no slug prefix)
  - Detected via `domainUtils.ts: detectDomain()` and `getStoreIdentifier()`
  - Admin routes protected by `StoreGuard` component

- **Main Platform**: `yesgive.shop`
  - Routes include `/admin/...`, `/superadmin/...`, `/home`, `/pricing`, `/auth`
  - Customer store routes prefixed with `/:slug/products`, `/:slug/cart`, etc.

**Key File**: `src/App.tsx` lines 92-203 - Routes branch on `domainInfo.isStoreSpecific`

#### 2. Authentication & Authorization
- **Store Owners**: Authenticated via Supabase Auth, protected by `StoreGuard` component
- **Super Admin**: Special super-admin users protected by `SuperAdminGuard` component
- **Helpers**: Referral/commission system users with separate login at `/helper/login`

**Guard Components**:
- `src/components/admin/StoreGuard.tsx` - Validates store ownership
- `src/components/superadmin/SuperAdminGuard.tsx` - Validates super-admin role

#### 3. State Management
- **Shopping Cart**: React Context via `CartContext` (`src/contexts/CartContext.tsx`)
- **Server State**: TanStack React Query for API calls and caching
- **UI State**: Component-level state + React Hook Form for forms
- **Theme**: next-themes for light/dark mode persistence

#### 4. Product & Store Data
- Products fetched from Supabase
- Demo products available in `src/lib/demoProducts.ts` for testing
- Product slugs used for URL routing (`/products/:slug`)
- Store data includes: name, logo, categories, settings, branding

#### 5. Forms & Validation
- All forms use **React Hook Form** + **Zod** for validation
- Validation schemas in `src/lib/dataValidation.ts`
- Error handling via toast notifications (Sonner)

#### 6. Integrations
- **Supabase**: Auth, database, real-time subscriptions
- **Shiprocket**: Shipping carrier integration (`src/lib/shiprocket.ts`)
- **WhatsApp**: Float widget for customer support (`src/components/customer/WhatsAppFloat.tsx`)
- **Google Reviews**: Review management in admin panel
- **Instagram**: Social media integration
- **PDF/Excel Export**: Store data export functionality

### Route Structure

#### Store-Specific (Subdomain/Custom Domain)
```
/                           → Store homepage (Store component)
/admin/dashboard            → Admin dashboard
/admin/products             → Product management
/admin/categories           → Category management
/admin/orders               → Order management
/admin/analytics            → Analytics & reports
/admin/growth/seo           → SEO settings
/admin/growth/social-media  → Social media settings
/admin/marketplace          → Marketplace integration
/admin/shipping             → Shipping configuration
/admin/settings             → Store settings
/products                   → Customer product listing
/products/:slug             → Product detail page
/cart                       → Shopping cart
/checkout                   → Checkout process
/payment-success            → Payment confirmation
```

#### Main Platform (yesgive.shop)
```
/                           → Platform landing page (Index)
/pricing                    → Pricing plans
/auth                       → Store owner signup/login
/home                       → Authenticated user home
/admin/*                    → Store admin routes (if owner)
/superadmin/*               → Super admin routes
/helper/login               → Helper login
/helper/dashboard           → Helper dashboard
/helper/my-referrals        → Referral management
/:slug/products             → Dynamic store products
/:slug/products/:productSlug → Dynamic store product detail
/:slug/cart                 → Dynamic store cart
/:slug/checkout             → Dynamic store checkout
/sitemap.xml                → XML sitemap
/privacy-policy             → Privacy policy
/terms-of-service           → Terms of service
```

**Important**: Admin routes MUST be defined BEFORE customer routes in React Router to prevent route conflicts.

## Key Development Considerations

### When Adding Features:
1. **Check domain context** - Determine if feature applies to store-specific or main platform routes
2. **Use the @ import alias** - All imports should use `@/` prefix (configured in `vite.config.ts`)
3. **Follow form patterns** - Use React Hook Form + Zod for any new forms
4. **Add to guards** - Admin features require StoreGuard protection
5. **Consider multi-store** - Features should work across all store contexts

### When Modifying Routes:
1. Keep admin routes BEFORE customer routes (they're matched in order)
2. Use StoreGuard for admin functionality
3. Use SuperAdminGuard for platform-level admin features
4. Pass `slug` prop to customer components when using dynamic routes

### Common Patterns:
- **Fetching store data**: Use Supabase queries filtered by store ID
- **Product fetching**: `productData.ts` contains product service functions
- **Image handling**: Use `imageUtils.ts` for optimization and defaults
- **Validation**: Schemas in `dataValidation.ts` for consistency
- **Error handling**: Use Sonner toast for user feedback

## Configuration Files

- **vite.config.ts**: Vite build config, path aliases, robots.txt plugin
- **eslint.config.js**: ESLint rules (React hooks, refresh, TypeScript)
- **tsconfig.json**: TypeScript compiler options (lenient settings, @ path alias)
- **tailwind.config.js**: Tailwind CSS configuration
- **components.json**: shadcn-ui component configuration

## Important Notes

### Code Quality
- ESLint is configured but lenient (unused vars/params disabled)
- TypeScript has relaxed strict mode settings
- No explicit null checks enforced

### Performance
- Vite handles code splitting automatically
- React Router enables lazy loading via component splitting
- Images should be optimized via `imageUtils.ts`
- Use React Query for efficient data fetching and caching

### Multi-Tenancy
- Always scope database queries by store ID
- Use `detectDomain()` and `getStoreIdentifier()` for context awareness
- Admin routes are store-scoped via StoreGuard
- Super admin routes are global

### SEO
- Sitemaps generated and submitted via `npm run submit-sitemaps`
- Meta tags managed via React Helmet
- Structured data via `StructuredData` component
- robots.txt auto-generated via Vite plugin

## Notes

**⚠️ Manual Deployment**: SQL migrations and Supabase Edge Functions require manual deployment. See `supabase/migrations/` and `supabase/functions/` directories.

## Code Modification Rules (PERMANENT)

**CRITICAL - Do NOT break existing working code:**
1. **BEFORE any code change**, read the existing code completely
2. **ASK clarifying questions** if the scope is unclear
3. **Show exactly what you will change** and get approval
4. **Make ONLY minimal changes** needed for the requested task
5. **NEVER refactor or touch** code that wasn't asked to be changed
6. **NEVER modify** existing working features or functionality
7. **NEVER add extra features** beyond what was explicitly requested
8. **Test thoroughly** to confirm nothing else broke
9. **If uncertain about scope**, ask - don't guess

This is non-negotiable - preserve all working code at all costs. This prevents wasted time fixing unintended side effects.
