import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const viewportRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if there are any toasts visible
      if (toasts.length === 0) return;

      // Check if click is outside the toast viewport
      if (viewportRef.current && !viewportRef.current.contains(event.target as Node)) {
        // Dismiss all toasts
        toasts.forEach((toast) => {
          dismiss(toast.id);
        });
      }
    };

    // Add event listener when toasts are visible, but with a slight delay
    // This prevents the click that created the toast from immediately dismissing it
    if (toasts.length > 0) {
      const timeoutId = setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 100);

      // Cleanup
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [toasts, dismiss]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport ref={viewportRef} />
    </ToastProvider>
  );
}
