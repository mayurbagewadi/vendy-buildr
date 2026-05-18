import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Phone, MessageCircle, Loader2, ArrowLeft, Sparkles } from "lucide-react";

const COUNTRIES = [
  { iso: "IN", flag: "🇮🇳", name: "India",              dialCode: "+91"  },
  { iso: "AF", flag: "🇦🇫", name: "Afghanistan",         dialCode: "+93"  },
  { iso: "DZ", flag: "🇩🇿", name: "Algeria",             dialCode: "+213" },
  { iso: "AO", flag: "🇦🇴", name: "Angola",              dialCode: "+244" },
  { iso: "AR", flag: "🇦🇷", name: "Argentina",           dialCode: "+54"  },
  { iso: "AU", flag: "🇦🇺", name: "Australia",           dialCode: "+61"  },
  { iso: "AT", flag: "🇦🇹", name: "Austria",             dialCode: "+43"  },
  { iso: "BH", flag: "🇧🇭", name: "Bahrain",             dialCode: "+973" },
  { iso: "BD", flag: "🇧🇩", name: "Bangladesh",          dialCode: "+880" },
  { iso: "BE", flag: "🇧🇪", name: "Belgium",             dialCode: "+32"  },
  { iso: "BT", flag: "🇧🇹", name: "Bhutan",              dialCode: "+975" },
  { iso: "BR", flag: "🇧🇷", name: "Brazil",              dialCode: "+55"  },
  { iso: "BG", flag: "🇧🇬", name: "Bulgaria",            dialCode: "+359" },
  { iso: "KH", flag: "🇰🇭", name: "Cambodia",            dialCode: "+855" },
  { iso: "CM", flag: "🇨🇲", name: "Cameroon",            dialCode: "+237" },
  { iso: "CL", flag: "🇨🇱", name: "Chile",               dialCode: "+56"  },
  { iso: "CN", flag: "🇨🇳", name: "China",               dialCode: "+86"  },
  { iso: "CO", flag: "🇨🇴", name: "Colombia",            dialCode: "+57"  },
  { iso: "HR", flag: "🇭🇷", name: "Croatia",             dialCode: "+385" },
  { iso: "CZ", flag: "🇨🇿", name: "Czech Republic",      dialCode: "+420" },
  { iso: "DK", flag: "🇩🇰", name: "Denmark",             dialCode: "+45"  },
  { iso: "EC", flag: "🇪🇨", name: "Ecuador",             dialCode: "+593" },
  { iso: "EG", flag: "🇪🇬", name: "Egypt",               dialCode: "+20"  },
  { iso: "ET", flag: "🇪🇹", name: "Ethiopia",            dialCode: "+251" },
  { iso: "FI", flag: "🇫🇮", name: "Finland",             dialCode: "+358" },
  { iso: "FR", flag: "🇫🇷", name: "France",              dialCode: "+33"  },
  { iso: "GH", flag: "🇬🇭", name: "Ghana",               dialCode: "+233" },
  { iso: "GR", flag: "🇬🇷", name: "Greece",              dialCode: "+30"  },
  { iso: "GT", flag: "🇬🇹", name: "Guatemala",           dialCode: "+502" },
  { iso: "HK", flag: "🇭🇰", name: "Hong Kong",           dialCode: "+852" },
  { iso: "HU", flag: "🇭🇺", name: "Hungary",             dialCode: "+36"  },
  { iso: "ID", flag: "🇮🇩", name: "Indonesia",           dialCode: "+62"  },
  { iso: "IR", flag: "🇮🇷", name: "Iran",                dialCode: "+98"  },
  { iso: "IQ", flag: "🇮🇶", name: "Iraq",                dialCode: "+964" },
  { iso: "IE", flag: "🇮🇪", name: "Ireland",             dialCode: "+353" },
  { iso: "IL", flag: "🇮🇱", name: "Israel",              dialCode: "+972" },
  { iso: "IT", flag: "🇮🇹", name: "Italy",               dialCode: "+39"  },
  { iso: "JP", flag: "🇯🇵", name: "Japan",               dialCode: "+81"  },
  { iso: "JO", flag: "🇯🇴", name: "Jordan",              dialCode: "+962" },
  { iso: "KE", flag: "🇰🇪", name: "Kenya",               dialCode: "+254" },
  { iso: "KW", flag: "🇰🇼", name: "Kuwait",              dialCode: "+965" },
  { iso: "LA", flag: "🇱🇦", name: "Laos",                dialCode: "+856" },
  { iso: "LB", flag: "🇱🇧", name: "Lebanon",             dialCode: "+961" },
  { iso: "LY", flag: "🇱🇾", name: "Libya",               dialCode: "+218" },
  { iso: "MY", flag: "🇲🇾", name: "Malaysia",            dialCode: "+60"  },
  { iso: "MV", flag: "🇲🇻", name: "Maldives",            dialCode: "+960" },
  { iso: "MA", flag: "🇲🇦", name: "Morocco",             dialCode: "+212" },
  { iso: "MZ", flag: "🇲🇿", name: "Mozambique",          dialCode: "+258" },
  { iso: "MM", flag: "🇲🇲", name: "Myanmar",             dialCode: "+95"  },
  { iso: "NP", flag: "🇳🇵", name: "Nepal",               dialCode: "+977" },
  { iso: "NL", flag: "🇳🇱", name: "Netherlands",         dialCode: "+31"  },
  { iso: "NZ", flag: "🇳🇿", name: "New Zealand",         dialCode: "+64"  },
  { iso: "NG", flag: "🇳🇬", name: "Nigeria",             dialCode: "+234" },
  { iso: "NO", flag: "🇳🇴", name: "Norway",              dialCode: "+47"  },
  { iso: "OM", flag: "🇴🇲", name: "Oman",                dialCode: "+968" },
  { iso: "PK", flag: "🇵🇰", name: "Pakistan",            dialCode: "+92"  },
  { iso: "PA", flag: "🇵🇦", name: "Panama",              dialCode: "+507" },
  { iso: "PE", flag: "🇵🇪", name: "Peru",                dialCode: "+51"  },
  { iso: "PH", flag: "🇵🇭", name: "Philippines",         dialCode: "+63"  },
  { iso: "PL", flag: "🇵🇱", name: "Poland",              dialCode: "+48"  },
  { iso: "PT", flag: "🇵🇹", name: "Portugal",            dialCode: "+351" },
  { iso: "QA", flag: "🇶🇦", name: "Qatar",               dialCode: "+974" },
  { iso: "RO", flag: "🇷🇴", name: "Romania",             dialCode: "+40"  },
  { iso: "RU", flag: "🇷🇺", name: "Russia / Kazakhstan", dialCode: "+7"   },
  { iso: "SA", flag: "🇸🇦", name: "Saudi Arabia",        dialCode: "+966" },
  { iso: "SN", flag: "🇸🇳", name: "Senegal",             dialCode: "+221" },
  { iso: "RS", flag: "🇷🇸", name: "Serbia",              dialCode: "+381" },
  { iso: "SG", flag: "🇸🇬", name: "Singapore",           dialCode: "+65"  },
  { iso: "ZA", flag: "🇿🇦", name: "South Africa",        dialCode: "+27"  },
  { iso: "KR", flag: "🇰🇷", name: "South Korea",         dialCode: "+82"  },
  { iso: "ES", flag: "🇪🇸", name: "Spain",               dialCode: "+34"  },
  { iso: "LK", flag: "🇱🇰", name: "Sri Lanka",           dialCode: "+94"  },
  { iso: "SD", flag: "🇸🇩", name: "Sudan",               dialCode: "+249" },
  { iso: "SE", flag: "🇸🇪", name: "Sweden",              dialCode: "+46"  },
  { iso: "CH", flag: "🇨🇭", name: "Switzerland",         dialCode: "+41"  },
  { iso: "TW", flag: "🇹🇼", name: "Taiwan",              dialCode: "+886" },
  { iso: "TZ", flag: "🇹🇿", name: "Tanzania",            dialCode: "+255" },
  { iso: "TH", flag: "🇹🇭", name: "Thailand",            dialCode: "+66"  },
  { iso: "TN", flag: "🇹🇳", name: "Tunisia",             dialCode: "+216" },
  { iso: "TR", flag: "🇹🇷", name: "Turkey",              dialCode: "+90"  },
  { iso: "AE", flag: "🇦🇪", name: "UAE",                 dialCode: "+971" },
  { iso: "UG", flag: "🇺🇬", name: "Uganda",              dialCode: "+256" },
  { iso: "UA", flag: "🇺🇦", name: "Ukraine",             dialCode: "+380" },
  { iso: "GB", flag: "🇬🇧", name: "UK",                  dialCode: "+44"  },
  { iso: "US", flag: "🇺🇸", name: "USA / Canada",        dialCode: "+1"   },
  { iso: "VN", flag: "🇻🇳", name: "Vietnam",             dialCode: "+84"  },
  { iso: "YE", flag: "🇾🇪", name: "Yemen",               dialCode: "+967" },
  { iso: "ZM", flag: "🇿🇲", name: "Zambia",              dialCode: "+260" },
  { iso: "ZW", flag: "🇿🇼", name: "Zimbabwe",            dialCode: "+263" },
];

const getDialCode = (iso: string): string =>
  COUNTRIES.find(c => c.iso === iso)?.dialCode ?? "+91";

const parsePhone = (full: string): { dialCode: string; number: string } => {
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const match = sorted.find(c => full.startsWith(c.dialCode));
  if (match) return { dialCode: match.dialCode, number: full.slice(match.dialCode.length) };
  return { dialCode: "+91", number: full };
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" } },
};

const errorVariants = {
  hidden: { opacity: 0, y: -4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

const BusinessDetails = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading]               = useState(false);
  const [geoLoading, setGeoLoading]         = useState(false);
  const [showErrors, setShowErrors]         = useState(false);
  const [storeId, setStoreId]               = useState<string | null>(null);
  const [highlighted, setHighlighted]       = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    country:       "IN",
    streetAddress: "",
    city:          "",
    state:         "",
    postalCode:    "",
    contactCode:   "+91",
    contactNumber: "",
    whatsappCode:  "+91",
    whatsappNumber:"",
  });

  useEffect(() => { init(); }, []);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const flash = (fields: string[]) => {
    setHighlighted(prev => {
      const next = new Set(prev);
      fields.forEach(f => next.add(f));
      return next;
    });
    setTimeout(() => {
      setHighlighted(prev => {
        const next = new Set(prev);
        fields.forEach(f => next.delete(f));
        return next;
      });
    }, 1600);
  };

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/onboarding/store-setup"); return; }

    const { data: store } = await supabase
      .from("stores")
      .select("id, country, street_address, city, state, postal_code, business_phone, whatsapp_number")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!store) { navigate("/onboarding/store-setup"); return; }
    setStoreId(store.id);

    const hasData = store.city || store.street_address || store.whatsapp_number;
    if (hasData) {
      const contact  = parsePhone(store.business_phone  || "");
      const whatsapp = parsePhone(store.whatsapp_number || "");
      setForm({
        country:        store.country        || "IN",
        streetAddress:  store.street_address || "",
        city:           store.city           || "",
        state:          store.state          || "",
        postalCode:     store.postal_code    || "",
        contactCode:    contact.dialCode,
        contactNumber:  contact.number,
        whatsappCode:   whatsapp.dialCode,
        whatsappNumber: whatsapp.number,
      });
      return;
    }

    fetchGeo();
  };

  const fetchGeo = async () => {
    setGeoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-geo");
      if (error || !data?.success || !data.data.is_detected) return;

      const geo      = data.data;
      const dialCode = getDialCode(geo.country);
      const updates: Partial<typeof form> = {};
      const toFlash: string[] = [];

      if (geo.country)     { updates.country = geo.country; updates.contactCode = dialCode; updates.whatsappCode = dialCode; toFlash.push("country"); }
      if (geo.city)        { updates.city        = geo.city;        toFlash.push("city");        }
      if (geo.region)      { updates.state       = geo.region;      toFlash.push("state");       }
      if (geo.postal_code) { updates.postalCode  = geo.postal_code; toFlash.push("postalCode"); }

      setForm(prev => ({ ...prev, ...updates }));
      flash(toFlash);
    } catch {
      // silent — user fills manually
    } finally {
      setGeoLoading(false);
    }
  };

  const handleCountryChange = (iso: string) => {
    const dialCode = getDialCode(iso);
    setForm(prev => ({
      ...prev,
      country:      iso,
      contactCode:  prev.contactNumber  ? prev.contactCode  : dialCode,
      whatsappCode: prev.whatsappNumber ? prev.whatsappCode : dialCode,
    }));
  };

  const isValid = () =>
    form.country.length === 2 &&
    form.streetAddress.trim().length >= 5 &&
    form.city.trim().length >= 2 &&
    form.state.trim().length >= 2 &&
    form.whatsappNumber.length >= 7;

  const handleSubmit = async () => {
    if (!isValid()) { setShowErrors(true); return; }
    if (!storeId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({
          country:        form.country,
          street_address: form.streetAddress  || null,
          city:           form.city           || null,
          state:          form.state          || null,
          postal_code:    form.postalCode     || null,
          business_phone: form.contactNumber
            ? `${form.contactCode}${form.contactNumber}`
            : null,
          whatsapp_number: `${form.whatsappCode}${form.whatsappNumber}`,
        })
        .eq("id", storeId);

      if (error) throw error;
      navigate("/onboarding/google-drive");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string, hasError: boolean) => {
    if (highlighted.has(field))
      return "border-green-400 bg-green-50 dark:bg-green-950/20 transition-colors duration-500";
    if (hasError)
      return "border-destructive focus-visible:ring-destructive";
    return "";
  };

  const selectedCountry = COUNTRIES.find(c => c.iso   === form.country)      ?? COUNTRIES[0];
  const contactEntry    = COUNTRIES.find(c => c.dialCode === form.contactCode) ?? COUNTRIES[0];
  const whatsappEntry   = COUNTRIES.find(c => c.dialCode === form.whatsappCode) ?? COUNTRIES[0];

  const err = {
    streetAddress:  showErrors && form.streetAddress.trim().length < 5,
    city:           showErrors && form.city.trim().length < 2,
    state:          showErrors && form.state.trim().length < 2,
    whatsappNumber: showErrors && form.whatsappNumber.length < 7,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div className="h-full bg-primary w-2/3 transition-all duration-300" />
      </div>

      {/* Step indicators */}
      <div className="container max-w-4xl mx-auto pt-8 pb-4 px-4">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-8 md:w-16 h-0.5 ${step < 2 ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">Step 2 of 3</p>
      </div>

      {/* Card */}
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg shadow-lg border p-6 md:p-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Business Details</h1>
            <p className="text-muted-foreground min-h-[1.5rem]">
              {geoLoading ? (
                <span className="inline-flex items-center justify-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Detecting your location…
                </span>
              ) : (
                "Tell us where your business is located"
              )}
            </p>
          </div>

          {/* Animated fields */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Country */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Country <span className="text-destructive">*</span>
              </Label>
              <Select value={form.country} onValueChange={handleCountryChange}>
                <SelectTrigger className={`w-full ${inputClass("country", false)}`}>
                  <span className="flex items-center gap-2">
                    <span>{selectedCountry.flag}</span>
                    <span>{selectedCountry.name}</span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.iso} value={c.iso}>
                      {c.flag} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            {/* Street Address */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <Label htmlFor="street" className="flex items-center gap-1.5">
                Street Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="street"
                placeholder="123 Main Road, Near Market"
                value={form.streetAddress}
                onChange={e => set("streetAddress", e.target.value)}
                className={inputClass("streetAddress", err.streetAddress)}
              />
              <AnimatePresence>
                {err.streetAddress && (
                  <motion.p key="street-err" variants={errorVariants} initial="hidden" animate="visible" exit="exit"
                    className="text-xs text-destructive">
                    Please enter a valid street address
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* City + State */}
            <motion.div variants={fieldVariants} className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-1.5">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="Mumbai"
                  value={form.city}
                  onChange={e => set("city", e.target.value)}
                  className={inputClass("city", err.city)}
                />
                <AnimatePresence>
                  {err.city && (
                    <motion.p key="city-err" variants={errorVariants} initial="hidden" animate="visible" exit="exit"
                      className="text-xs text-destructive">
                      City is required
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="flex items-center gap-1.5">
                  State / Region <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="state"
                  placeholder="Maharashtra"
                  value={form.state}
                  onChange={e => set("state", e.target.value)}
                  className={inputClass("state", err.state)}
                />
                <AnimatePresence>
                  {err.state && (
                    <motion.p key="state-err" variants={errorVariants} initial="hidden" animate="visible" exit="exit"
                      className="text-xs text-destructive">
                      State is required
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Pincode */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <Label htmlFor="pincode">Pincode / Postal Code</Label>
              <Input
                id="pincode"
                placeholder="400001"
                value={form.postalCode}
                onChange={e => set("postalCode", e.target.value.replace(/\D/g, ""))}
                className={inputClass("postalCode", false)}
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Auto-filled if detected — you can correct it
              </p>
            </motion.div>

            {/* Divider */}
            <motion.div variants={fieldVariants}>
              <div className="border-t pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-1">
                  Contact Information
                </p>
              </div>
            </motion.div>

            {/* Contact Number (optional) */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <Label htmlFor="contact" className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                Contact Number
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="flex gap-2">
                <Select value={form.contactCode} onValueChange={v => set("contactCode", v)}>
                  <SelectTrigger className="w-28 min-w-[7rem]">
                    <span className="flex items-center gap-1">
                      <span>{contactEntry.flag}</span>
                      <span>{form.contactCode}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.iso} value={c.dialCode}>
                        {c.flag} {c.name} ({c.dialCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="contact"
                  type="tel"
                  placeholder="9876543210"
                  value={form.contactNumber}
                  onChange={e => set("contactNumber", e.target.value.replace(/\D/g, ""))}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">Office or personal phone number</p>
            </motion.div>

            {/* WhatsApp Business Number (required) */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                WhatsApp Business Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select value={form.whatsappCode} onValueChange={v => set("whatsappCode", v)}>
                  <SelectTrigger className="w-28 min-w-[7rem]">
                    <span className="flex items-center gap-1">
                      <span>{whatsappEntry.flag}</span>
                      <span>{form.whatsappCode}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.iso} value={c.dialCode}>
                        {c.flag} {c.name} ({c.dialCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="9876543210"
                  value={form.whatsappNumber}
                  onChange={e => set("whatsappNumber", e.target.value.replace(/\D/g, ""))}
                  className={`flex-1 ${inputClass("whatsappNumber", err.whatsappNumber)}`}
                />
              </div>
              <AnimatePresence>
                {err.whatsappNumber && (
                  <motion.p key="wa-err" variants={errorVariants} initial="hidden" animate="visible" exit="exit"
                    className="text-xs text-destructive">
                    Enter a valid WhatsApp number
                  </motion.p>
                )}
              </AnimatePresence>
              {!err.whatsappNumber && (
                <p className="text-xs text-muted-foreground">
                  Customers will place orders via WhatsApp to this number
                </p>
              )}
            </motion.div>
          </motion.div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate("/onboarding/store-setup")}
              className="order-2 sm:order-1 w-full sm:w-auto min-h-[48px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <div
              className="order-1 sm:order-2 w-full sm:w-auto"
              onClick={() => { if (!isValid() && !loading) setShowErrors(true); }}
            >
              <Button
                onClick={handleSubmit}
                disabled={!isValid() || loading}
                size="lg"
                className="w-full sm:w-auto min-h-[48px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessDetails;
