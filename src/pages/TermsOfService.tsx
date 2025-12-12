import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">
          Last Updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Digital Dukandar's services available at <a href="https://digitaldukandar.in" className="text-primary hover:underline">digitaldukandar.in</a> ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              YesGive is a multi-vendor e-commerce platform that enables:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Store owners to create and manage online stores</li>
              <li>Product listing and inventory management</li>
              <li>Order processing through WhatsApp and website checkouts</li>
              <li>Customer management and analytics</li>
              <li>Subscription-based access to platform features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <h3 className="text-xl font-semibold mb-3">3.1 Account Creation</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To use certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activities under your account</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">3.2 Account Types</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Store Owners:</strong> Can create stores, manage products, and process orders</li>
              <li><strong>Customers:</strong> Can browse stores, place orders, and manage their profiles</li>
              <li><strong>Super Admin:</strong> Platform administrators with full access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Subscription Plans and Payments</h2>
            <h3 className="text-xl font-semibold mb-3">4.1 Subscription Tiers</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We offer various subscription plans (Free, Basic, Pro, Enterprise) with different features and limits. Plan details are available on our Pricing page.
            </p>

            <h3 className="text-xl font-semibold mb-3">4.2 Payment Terms</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Subscriptions are billed monthly or yearly in advance</li>
              <li>Payments are non-refundable except as required by law</li>
              <li>You authorize automatic renewal unless cancelled before the renewal date</li>
              <li>We reserve the right to change pricing with 30 days' notice</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">4.3 Free Trials</h3>
            <p className="text-muted-foreground leading-relaxed">
              Free trial periods are subject to terms disclosed at sign-up. We may require payment information upfront but won't charge until the trial ends unless you cancel.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Store Owner Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              As a store owner, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide accurate product descriptions and pricing</li>
              <li>Honor all orders placed through your store</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Not sell prohibited items (illegal goods, counterfeit products, etc.)</li>
              <li>Handle customer data responsibly and securely</li>
              <li>Respond to customer inquiries in a timely manner</li>
              <li>Process refunds and returns according to your stated policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Prohibited Activities</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You may not use our Platform to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violate any laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit harmful code, viruses, or malware</li>
              <li>Engage in fraudulent activities or scams</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Scrape or copy content without permission</li>
              <li>Interfere with the Platform's operation</li>
              <li>Create fake accounts or impersonate others</li>
              <li>Manipulate prices, reviews, or ratings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Content and Intellectual Property</h2>
            <h3 className="text-xl font-semibold mb-3">7.1 Your Content</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You retain ownership of content you upload (products, images, descriptions). By uploading content, you grant us a license to display, store, and distribute it as necessary to provide our services.
            </p>

            <h3 className="text-xl font-semibold mb-3">7.2 Our Content</h3>
            <p className="text-muted-foreground leading-relaxed">
              The Platform, including its design, features, and code, is protected by copyright and other intellectual property laws. You may not copy, modify, or distribute our content without permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Order Processing and Transactions</h2>
            <h3 className="text-xl font-semibold mb-3">8.1 Order Placement</h3>
            <p className="text-muted-foreground leading-relaxed">
              Orders placed through the Platform constitute an offer to purchase. Store owners reserve the right to accept or decline orders.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">8.2 Payment Processing</h3>
            <p className="text-muted-foreground leading-relaxed">
              Currently, orders are processed via Cash on Delivery (COD) or direct WhatsApp communication. Future payment integrations may be added.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">8.3 Disputes</h3>
            <p className="text-muted-foreground leading-relaxed">
              YesGive acts as a platform provider. Disputes regarding orders, refunds, or product quality should be resolved directly between customers and store owners. We may assist in mediation but are not responsible for transaction outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may suspend or terminate your account if you:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violate these Terms</li>
              <li>Engage in fraudulent or illegal activities</li>
              <li>Fail to pay subscription fees</li>
              <li>Create risk or legal liability for us</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You may cancel your account at any time through account settings. Upon termination, you lose access to your store and data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimers and Limitations of Liability</h2>
            <h3 className="text-xl font-semibold mb-3">10.1 Service Availability</h3>
            <p className="text-muted-foreground leading-relaxed">
              We strive for 99.9% uptime but do not guarantee uninterrupted service. We are not liable for downtime, data loss, or service interruptions.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">10.2 No Warranty</h3>
            <p className="text-muted-foreground leading-relaxed">
              The Platform is provided "as is" without warranties of any kind, express or implied. We do not guarantee that the service will be error-free or secure.
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">10.3 Limitation of Liability</h3>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, YesGive shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold YesGive harmless from any claims, damages, or expenses arising from your use of the Platform, violation of these Terms, or infringement of any rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these Terms at any time. Changes will be effective upon posting. Continued use of the Platform constitutes acceptance of modified Terms. Material changes will be communicated via email or platform notifications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law and Dispute Resolution</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              These Terms are governed by the laws of India. Any disputes shall be resolved through:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Informal negotiation (30 days)</li>
              <li>Binding arbitration (if negotiation fails)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              For questions about these Terms, please contact us:
            </p>
            <div className="bg-accent p-4 rounded-lg">
              <p className="text-muted-foreground">
                <strong>Email:</strong> support@digitaldukandar.in<br />
                <strong>Website:</strong> <a href="https://digitaldukandar.in" className="text-primary hover:underline">https://digitaldukandar.in</a>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">16. Entire Agreement</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and YesGive regarding use of the Platform.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} YesGive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
