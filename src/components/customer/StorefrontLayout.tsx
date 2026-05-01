import { Outlet, useParams } from 'react-router-dom';
import { StoreProvider } from '@/contexts/StoreContext';

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
      <Outlet />
    </StoreProvider>
  );
};

export default StorefrontLayout;
