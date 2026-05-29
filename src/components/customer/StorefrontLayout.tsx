import { Outlet, useParams } from 'react-router-dom';
import { StoreProvider, useStorefront } from '@/contexts/StoreContext';
import { useAIDesignCSS } from '@/hooks/useAIDesignCSS';

interface StorefrontLayoutProps {
  // Provided by App.tsx for subdomain/custom-domain routes where the slug
  // is known at app level (not in the URL path).
  slug?: string;
}

const StorefrontLayout = ({ slug: slugProp }: StorefrontLayoutProps = {}) => {
  const { slug: paramSlug } = useParams<{ slug?: string }>();
  const slug = slugProp ?? paramSlug;

  return (
    <StoreProvider slug={slug}>
      <StorefrontDesignLoader />
      <Outlet />
    </StoreProvider>
  );
};

const StorefrontDesignLoader = () => {
  const { storeId, storeSlug } = useStorefront();
  useAIDesignCSS(storeId, storeSlug);
  return null;
};

export default StorefrontLayout;
