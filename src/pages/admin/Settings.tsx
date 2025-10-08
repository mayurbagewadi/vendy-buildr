import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Save, Upload, Store, Phone, Mail, MapPin, MessageCircle, Image } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { getSettings, saveSettings } from "@/lib/settingsData";

const AdminSettings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    storeName: "",
    tagline: "",
    logoUrl: "",
    heroImageUrl: "",
    phone: "",
    email: "",
    address: "",
    whatsappNumber: "",
    currency: "INR",
    currencySymbol: "₹",
    deliveryAreas: "",
    returnPolicy: "",
    shippingPolicy: "",
    termsConditions: "",
  });

  useEffect(() => {
    // Load existing settings from centralized settings
    const settings = getSettings();
    
    // Load additional settings from old localStorage format for backward compatibility
    const oldSettings = localStorage.getItem("storeSettings");
    const extraData = oldSettings ? JSON.parse(oldSettings) : {};
    
    setFormData({
      storeName: settings.storeName,
      tagline: extraData.tagline || "",
      logoUrl: extraData.logoUrl || "",
      heroImageUrl: extraData.heroImageUrl || "",
      phone: extraData.phone || "",
      email: settings.email || "",
      address: settings.address || "",
      whatsappNumber: settings.whatsappNumber,
      currency: settings.currency || "INR",
      currencySymbol: settings.currencySymbol || "₹",
      deliveryAreas: extraData.deliveryAreas || "",
      returnPolicy: extraData.returnPolicy || "",
      shippingPolicy: extraData.shippingPolicy || "",
      termsConditions: extraData.termsConditions || "",
    });
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!formData.storeName.trim()) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Store name is required",
        });
        setIsLoading(false);
        return;
      }

      // Save to centralized settings
      const settings = getSettings();
      saveSettings({
        ...settings,
        storeName: formData.storeName,
        whatsappNumber: formData.whatsappNumber,
        email: formData.email,
        address: formData.address,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
      });

      // Save additional fields to old format for backward compatibility
      localStorage.setItem("storeSettings", JSON.stringify(formData));
      
      toast({
        title: "Settings Saved",
        description: "Your store settings have been updated successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "There was an error saving your settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const settingSections = [
    {
      title: "Store Information",
      icon: Store,
      fields: [
        { key: "storeName", label: "Store Name", placeholder: "My Awesome Store", required: true },
        { key: "tagline", label: "Store Tagline", placeholder: "Your one-stop shop for everything" },
        { key: "logoUrl", label: "Logo URL (Google Drive Link)", placeholder: "https://drive.google.com/..." },
        { key: "heroImageUrl", label: "Hero Banner URL (Google Drive Link)", placeholder: "https://drive.google.com/..." },
      ]
    },
    {
      title: "Contact Information", 
      icon: Phone,
      fields: [
        { key: "phone", label: "Phone Number", placeholder: "+1 (555) 123-4567" },
        { key: "email", label: "Email Address", placeholder: "contact@yourstore.com" },
        { key: "whatsappNumber", label: "WhatsApp Business Number", placeholder: "919876543210 (with country code, no spaces)" },
        { key: "address", label: "Store Address", placeholder: "123 Main St, City, State 12345", multiline: true },
      ]
    },
    {
      title: "Currency Settings",
      icon: Store,
      fields: [
        { key: "currencySymbol", label: "Currency Symbol", placeholder: "₹, $, €, £, etc." },
        { key: "currency", label: "Currency Code", placeholder: "INR, USD, EUR, GBP, etc." },
      ]
    }
  ];

  const policyFields = [
    { key: "deliveryAreas", label: "Delivery Areas", placeholder: "List areas where you deliver..." },
    { key: "returnPolicy", label: "Return Policy", placeholder: "Describe your return policy..." },
    { key: "shippingPolicy", label: "Shipping Policy", placeholder: "Describe your shipping terms..." },
    { key: "termsConditions", label: "Terms & Conditions", placeholder: "Your terms and conditions..." },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Store Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure your store information and policies
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Store Information & Contact Sections */}
          {settingSections.map((section, sectionIndex) => (
            <Card key={sectionIndex} className="admin-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className={field.multiline ? "md:col-span-2" : ""}>
                      <Label htmlFor={field.key} className="flex items-center gap-2">
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </Label>
                      {field.multiline ? (
                        <Textarea
                          id={field.key}
                          placeholder={field.placeholder}
                          value={formData[field.key as keyof typeof formData]}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          className="admin-input min-h-[100px] mt-2"
                          required={field.required}
                        />
                      ) : (
                        <Input
                          id={field.key}
                          type="text"
                          placeholder={field.placeholder}
                          value={formData[field.key as keyof typeof formData]}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          className="admin-input mt-2"
                          required={field.required}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Policies Section */}
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                Store Policies
              </CardTitle>
              <p className="text-muted-foreground">Define your store policies and terms</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {policyFields.map((field, index) => (
                <div key={index}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Textarea
                    id={field.key}
                    placeholder={field.placeholder}
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    className="admin-input min-h-[120px] mt-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* File Upload Tips */}
          <Card className="admin-card bg-muted/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Image Upload Tips</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Upload images to Google Drive and use the sharing link</li>
                    <li>• Make sure images are set to "Anyone with the link can view"</li>
                    <li>• Recommended logo size: 200x80px (PNG/JPG)</li>
                    <li>• Recommended hero banner: 1200x400px (JPG/PNG)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              className="admin-button-primary min-w-[150px]"
              disabled={isLoading}
            >
              {isLoading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;