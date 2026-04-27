import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { openWhatsApp, generateGeneralInquiryMessage } from '@/lib/whatsappUtils';

interface WhatsAppFloatProps {
  storeId?: string;
}

const WhatsAppFloat = ({ storeId }: WhatsAppFloatProps) => {
  const [shouldHop, setShouldHop] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldHop(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    const message = generateGeneralInquiryMessage();
    openWhatsApp(message, undefined, storeId);
  };

  return (
    <Button
      onClick={handleClick}
      className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-none z-50 bg-transparent hover:bg-transparent p-0 border-0 overflow-hidden${shouldHop ? ' animate-whatsapp-hop' : ''}`}
      title="Chat with us on WhatsApp"
      aria-label="Chat with us on WhatsApp"
    >
      <img src="/whatsapp-icon.png" alt="WhatsApp" className="h-14 w-14 rounded-full" />
    </Button>
  );
};

export default WhatsAppFloat;
