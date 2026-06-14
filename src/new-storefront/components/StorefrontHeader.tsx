import Header from "@/components/customer/Header";
import { useStorefront } from "@/contexts/StoreContext";
import { ECOSOAP_THEME, getThemeByTemplate } from "@/lib/themeRegistry";
import EcoSoapHeader from "./EcoSoapHeader";

interface StorefrontHeaderProps {
  storeSlug?: string;
  storeId?: string;
}

const StorefrontHeader = (props: StorefrontHeaderProps) => {
  const { store } = useStorefront();
  const activeTheme = getThemeByTemplate(store?.storefront_template);
  if (activeTheme?.id === ECOSOAP_THEME.id) {
    return <EcoSoapHeader {...props} />;
  }

  const cartVariant = activeTheme?.id === ECOSOAP_THEME.id ? "ecosoap" : "default";

  return <Header {...props} cartVariant={cartVariant} />;
};

export default StorefrontHeader;
