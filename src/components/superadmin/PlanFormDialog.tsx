import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const planFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().optional(),
  monthly_price: z.coerce.number().min(0, "Price must be 0 or greater"),
  yearly_price: z.coerce.number().min(0, "Price must be 0 or greater").optional(),
  max_products: z.coerce.number().optional(),
  enable_whatsapp_orders: z.boolean().default(false),
  whatsapp_orders_limit: z.coerce.number().optional(),
  enable_website_orders: z.boolean().default(false),
  website_orders_limit: z.coerce.number().optional(),
  trial_days: z.coerce.number().min(0).default(14),
  is_active: z.boolean().default(true),
  is_popular: z.boolean().default(false),
  badge_text: z.string().optional(),
  badge_color: z.string().optional(),
  display_order: z.coerce.number().default(0),
  enable_location_sharing: z.boolean().default(false),
  enable_analytics: z.boolean().default(false),
  enable_order_emails: z.boolean().default(false),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PlanFormValues) => Promise<void>;
  defaultValues?: Partial<PlanFormValues>;
  mode: "add" | "edit";
}

export const PlanFormDialog = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
}: PlanFormDialogProps) => {
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      monthly_price: 0,
      yearly_price: 0,
      max_products: undefined,
      enable_whatsapp_orders: false,
      whatsapp_orders_limit: undefined,
      enable_website_orders: false,
      website_orders_limit: undefined,
      trial_days: 14,
      is_active: true,
      is_popular: false,
      badge_text: "",
      badge_color: "",
      display_order: 0,
      enable_location_sharing: false,
      enable_analytics: false,
      enable_order_emails: false,
    },
  });

  // Reset form with new values when dialog opens or defaultValues change
  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues);
    } else if (open && !defaultValues) {
      form.reset({
        name: "",
        slug: "",
        description: "",
        monthly_price: 0,
        yearly_price: 0,
        max_products: undefined,
        enable_whatsapp_orders: false,
        whatsapp_orders_limit: undefined,
        enable_website_orders: false,
        website_orders_limit: undefined,
        trial_days: 14,
        is_active: true,
        is_popular: false,
        badge_text: "",
        badge_color: "",
        display_order: 0,
        enable_location_sharing: false,
        enable_analytics: false,
        enable_order_emails: false,
      });
    }
  }, [open, defaultValues, form]);

  const handleSubmit = async (values: PlanFormValues) => {
    await onSubmit(values);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New Plan" : "Edit Plan"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Create a new subscription plan with custom features."
              : "Update the subscription plan details and features."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Free, Pro, Business" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Slug
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Unique identifier used in URLs and code. Must be lowercase with hyphens only.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., free, pro, business" {...field} />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers, and hyphens only
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of the plan"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Pricing</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="monthly_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="yearly_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yearly Price (₹)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Limits & Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Limits & Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="max_products"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Products</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Leave empty for unlimited" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Empty = Unlimited
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trial_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trial Days</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Display Order
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Controls the order in which plans appear on the pricing page. Lower numbers (0, 1, 2...) appear first.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormDescription>
                      Lower numbers appear first
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enable_whatsapp_orders"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">WhatsApp Orders Limit</FormLabel>
                      <FormDescription>
                        Set a monthly limit for WhatsApp orders
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("enable_whatsapp_orders") && (
                <FormField
                  control={form.control}
                  name="whatsapp_orders_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        WhatsApp Orders per Month
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Maximum number of orders store owners can receive via WhatsApp per billing period.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter number of orders" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="enable_website_orders"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Website Orders Limit</FormLabel>
                      <FormDescription>
                        Set a monthly limit for website orders
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("enable_website_orders") && (
                <FormField
                  control={form.control}
                  name="website_orders_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Website Orders per Month
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Maximum number of orders store owners can receive via website per billing period.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter number of orders" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Separator />

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Features</h3>
              
              <FormField
                control={form.control}
                name="enable_location_sharing"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Location Sharing</FormLabel>
                      <FormDescription>
                        Allow users to share delivery locations
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enable_analytics"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Analytics</FormLabel>
                      <FormDescription>
                        Access to analytics dashboard and reports
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enable_order_emails"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Order Email Notifications</FormLabel>
                      <FormDescription>
                        Send email notifications to store owners when new orders arrive
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Badge & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Badge & Status</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="badge_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Text</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Most Popular" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="badge_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Color</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., blue, green" 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_popular"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Mark as Popular</FormLabel>
                      <FormDescription>
                        Highlight this plan with a special border
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Make this plan available to users
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : mode === "add" ? "Create Plan" : "Update Plan"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
