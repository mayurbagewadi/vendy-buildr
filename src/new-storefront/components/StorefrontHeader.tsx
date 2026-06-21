import Header from "@/components/customer/Header";
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

  if (ThemeHeader) {
    return <ThemeHeader {...props} />;
  }

  const cartVariant = activeTheme?.cartVariant ?? "default";

  return <Header {...props} cartVariant={cartVariant} />;
};

export default StorefrontHeader;
