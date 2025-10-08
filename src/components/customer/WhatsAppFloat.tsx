import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openWhatsApp, generateGeneralInquiryMessage } from '@/lib/whatsappUtils';

const WhatsAppFloat = () => {
  const handleClick = () => {
    const message = generateGeneralInquiryMessage();
    openWhatsApp(message);
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 bg-[#25D366] hover:bg-[#20BA5A] text-white p-0"
      title="Chat with us on WhatsApp"
      aria-label="Chat with us on WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
};

export default WhatsAppFloat;
