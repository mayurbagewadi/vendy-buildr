import Header from "@/components/customer/Header";
import ThemeRenderBoundary from "@/new-storefront/theme-engine/ThemeRenderBoundary";
import {
  useActiveStorefrontTheme,
  useActiveStorefrontThemeRuntime,
} from "@/new-storefront/theme-engine/resolveTheme";

interface StorefrontHeaderProps {
  storeSlug?: string;
  storeId?: string;
}

const StorefrontHeader = (props: StorefrontHeaderProps) => {
  const activeTheme = useActiveStorefrontTheme();
  const { runtime } = useActiveStorefrontThemeRuntime();
  const ThemeHeader = runtime?.components.Header;
  const cartVariant = activeTheme?.cartVariant ?? "default";
  const fallbackHeader = <Header {...props} cartVariant={cartVariant} />;

  if (ThemeHeader) {
    return (
      <ThemeRenderBoundary fallback={fallbackHeader}>
        <ThemeHeader {...props} />
      </ThemeRenderBoundary>
    );
  }

  return fallbackHeader;
};

export default StorefrontHeader;
