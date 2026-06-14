import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { visitorThemeKey, useStorefront } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
}

export function ThemeToggle({ triggerClassName, contentClassName, itemClassName }: ThemeToggleProps = {}) {
  const { setTheme } = useTheme();
  const { storeSlug } = useStorefront();

  const handleSetTheme = (value: string) => {
    // BUG-6 fix: use per-store key so toggle on Store A doesn't affect Store B.
    localStorage.setItem(visitorThemeKey(storeSlug), value);
    setTheme(value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("transition-all duration-300 hover:scale-110 hover:rotate-12 border-primary", triggerClassName)}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-primary" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={contentClassName}>
        <DropdownMenuItem onClick={() => handleSetTheme("light")} className={itemClassName}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("dark")} className={itemClassName}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetTheme("system")} className={itemClassName}>
          <span className="mr-2 h-4 w-4">💻</span>
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
