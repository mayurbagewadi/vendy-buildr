import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
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
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">
          Last Updated: {new Date().toLocaleDateString()}
        </p>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to YesGive ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <a href="https://yesgive.shop" className="text-primary hover:underline">yesgive.shop</a> and use our multi-vendor store platform services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold mb-3">2.1 Personal Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect personal information that you voluntarily provide to us when you:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Register for an account (name, email address, phone number)</li>
              <li>Create a store or product listing</li>
              <li>Make a purchase through our platform</li>
              <li>Contact our customer support</li>
              <li>Sign in using Google OAuth (email, profile picture, name)</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you visit our website, we automatically collect certain information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and location data</li>
              <li>Usage data (pages visited, time spent on pages)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>To create and manage your account</li>
              <li>To process transactions and deliver products/services</li>
              <li>To send order confirmations and updates</li>
              <li>To provide customer support</li>
              <li>To improve our platform and user experience</li>
              <li>To send promotional communications (with your consent)</li>
              <li>To comply with legal obligations</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may share your information in the following situations:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>With Store Owners:</strong> When you make a purchase, we share your order details with the relevant store owner</li>
              <li><strong>Service Providers:</strong> We may share data with third-party service providers (payment processors, hosting services, analytics providers)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information. This includes encryption, secure servers, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Your Privacy Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Data Portability:</strong> Request your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to enhance your experience on our platform. Cookies help us remember your preferences, analyze site usage, and provide personalized content. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Our platform integrates with third-party services:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Google OAuth:</strong> For authentication (subject to Google's Privacy Policy)</li>
              <li><strong>Supabase:</strong> For database and authentication services</li>
              <li><strong>WhatsApp:</strong> For order notifications</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              These services have their own privacy policies, and we encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-accent p-4 rounded-lg">
              <p className="text-muted-foreground">
                <strong>Email:</strong> support@yesgive.shop<br />
                <strong>Website:</strong> <a href="https://yesgive.shop" className="text-primary hover:underline">https://yesgive.shop</a>
              </p>
            </div>
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

export default PrivacyPolicy;
