import type { Plugin } from 'vite';

interface Store {
  id: string;
  slug: string;
  subdomain: string | null;
  custom_domain: string | null;
}

// AI Crawlers section to add to robots.txt
const AI_CRAWLERS_SECTION = `
# AI Crawlers - Allow for AI search and recommendations
# ChatGPT / OpenAI
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# Google Gemini / Bard
User-agent: Google-Extended
Allow: /

# Anthropic Claude
User-agent: anthropic-ai
Allow: /

User-agent: Claude-Web
Allow: /

# Perplexity AI
User-agent: PerplexityBot
Allow: /

# Common Crawl (used by many AI models)
User-agent: CCBot
Allow: /
`;

export default function robotsTxtPlugin(): Plugin {
  return {
    name: 'vite-plugin-robots-txt',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/robots.txt') {
          const host = req.headers.host || '';
          const currentDate = new Date().toISOString().split('T')[0];

          // Determine if this is a store-specific domain
          const isStoreSpecific =
            host.includes('.digitaldukandar.in') &&
            !host.startsWith('digitaldukandar.in') &&
            !host.startsWith('www.digitaldukandar.in');

          let robotsTxt = '';

          if (isStoreSpecific) {
            // Extract subdomain
            const subdomain = host.split('.digitaldukandar.in')[0];
            const storeBaseUrl = `https://${host}`;

            robotsTxt = `# Robots.txt for ${subdomain}
# Updated: ${currentDate}

# Allow all major search engines
User-agent: Googlebot
Crawl-delay: 0
Allow: /

User-agent: Bingbot
Crawl-delay: 1
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /
${AI_CRAWLERS_SECTION}
# Allow all bots by default
User-agent: *
Allow: /

# Disallow admin pages
Disallow: /admin/
Disallow: /superadmin/
Disallow: /onboarding/

# Sitemap location
Sitemap: ${storeBaseUrl}/sitemap.xml

# Block aggressive crawlers
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /
`;
          } else {
            // Platform-wide robots.txt
            robotsTxt = `# Robots.txt for DigitalDukandar
# Updated: ${currentDate}

# Allow all major search engines
User-agent: Googlebot
Crawl-delay: 0
Allow: /

User-agent: Bingbot
Crawl-delay: 1
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /
${AI_CRAWLERS_SECTION}
# Allow all bots by default
User-agent: *
Allow: /
Allow: /pricing
Allow: /auth
Allow: /become-helper
Allow: /privacy-policy
Allow: /terms-of-service

# Disallow admin and internal pages from indexing
Disallow: /admin/
Disallow: /superadmin/
Disallow: /onboarding/
Disallow: /helper/
Disallow: /application-status

# Disallow API endpoints
Disallow: /api/

# Sitemap location
Sitemap: https://digitaldukandar.in/sitemap.xml

# Block aggressive crawlers
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /
`;
          }

          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(robotsTxt);
          return;
        }
        next();
      });
    },
  };
}
