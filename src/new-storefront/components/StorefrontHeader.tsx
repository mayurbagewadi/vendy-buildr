import Header from "@/components/customer/Header";
import { useActiveStorefrontTheme } from "@/new-storefront/theme-engine/resolveTheme";

interface StorefrontHeaderProps {
  storeSlug?: string;
  storeId?: string;
}

const StorefrontHeader = (props: StorefrontHeaderProps) => {
  const activeTheme = useActiveStorefrontTheme();
  const ThemeHeader = activeTheme?.components.Header;

  if (ThemeHeader) {
    return <ThemeHeader {...props} />;
  }

  const cartVariant = activeTheme?.cartVariant ?? "default";

  return <Header {...props} cartVariant={cartVariant} />;
};

export default StorefrontHeader;
