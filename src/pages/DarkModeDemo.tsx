import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/customer/Header";

const DarkModeDemo = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className="min-h-screen">
      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setIsDark(!isDark)}
          variant="outline"
          size="icon"
          className="rounded-full"
        >
          {isDark ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Light Mode Demo */}
      {!isDark && (
        <div className="w-full bg-background">
          <Header storeId="demo-store" storeSlug="demo" />

          <div className="container mx-auto px-4 py-20">
            <h1 className="text-4xl font-bold text-foreground mb-4">Light Mode</h1>
            <p className="text-muted-foreground mb-8">
              Header with dynamic store name and logo
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* With Logo */}
              <div className="border border-border rounded-lg p-8 bg-card">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  With Logo Image
                </h2>
                <div className="border border-dashed border-border rounded p-4">
                  <img
                    src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=80&fit=crop"
                    alt="Demo logo"
                    className="h-8 w-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Shows only logo, store name hidden
                </p>
              </div>

              {/* Without Logo (Shows Name) */}
              <div className="border border-border rounded-lg p-8 bg-card">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Without Logo (Name Fallback)
                </h2>
                <div className="border border-dashed border-border rounded p-4 flex items-center gap-2">
                  <div className="bg-blue-600 rounded-lg p-2">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"
                      />
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-foreground">
                    My Store
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Shows AppLogo + store name
                </p>
              </div>
            </div>

            <div className="mt-12 p-8 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Store owner sets name + logo in Admin → Settings</li>
                <li>✓ Header fetches from stores table (Supabase)</li>
                <li>✓ If logo URL: convert Google Drive link to direct image</li>
                <li>✓ Display logic: logo only OR name+icon (not both)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Dark Mode Demo */}
      {isDark && (
        <div className="w-full bg-background">
          <Header storeId="demo-store" storeSlug="demo" />

          <div className="container mx-auto px-4 py-20">
            <h1 className="text-4xl font-bold text-foreground mb-4">Dark Mode</h1>
            <p className="text-muted-foreground mb-8">
              Same header, optimized colors for dark theme
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* With Logo */}
              <div className="border border-border rounded-lg p-8 bg-card">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  With Logo Image
                </h2>
                <div className="border border-dashed border-border rounded p-4">
                  <img
                    src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=80&fit=crop"
                    alt="Demo logo"
                    className="h-8 w-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Shows only logo, store name hidden
                </p>
              </div>

              {/* Without Logo (Shows Name) */}
              <div className="border border-border rounded-lg p-8 bg-card">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Without Logo (Name Fallback)
                </h2>
                <div className="border border-dashed border-border rounded p-4 flex items-center gap-2">
                  <div className="bg-blue-600 rounded-lg p-2">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"
                      />
                    </svg>
                  </div>
                  <span className="text-xl font-bold text-foreground">
                    My Store
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Shows AppLogo + store name
                </p>
              </div>
            </div>

            <div className="mt-12 p-8 bg-slate-900 border border-slate-700 rounded-lg">
              <h3 className="font-semibold text-slate-100 mb-2">Dark Mode Features:</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>✓ Auto-detects system dark mode preference</li>
                <li>✓ Manual toggle in top-right</li>
                <li>✓ All colors adapt: foreground, background, borders</li>
                <li>✓ Used next-themes for persistent preference</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DarkModeDemo;
