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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" className="h-14 w-14" aria-hidden="true">
        <circle cx="28" cy="28" r="28" fill="#25D366"/>
        <path fill="#fff" d="M28.014 13C19.73 13 13 19.729 13 28.013c0 2.662.703 5.25 2.04 7.532L13 43l7.765-2.025A15.02 15.02 0 0028.014 43C36.298 43 43 36.27 43 27.987 43 19.703 36.298 13 28.014 13zm8.75 21.157c-.37.988-2.14 1.896-2.957 1.978-.762.076-1.73.107-2.782-.174-1.65-.474-3.76-1.233-5.717-3.022-2.868-2.631-4.557-6.152-4.814-6.578-.258-.425-2.082-2.764-2.082-5.265 0-2.5 1.312-3.75 1.776-4.263.464-.514 1.016-.641 1.354-.641.338 0 .677.003.974.018.311.015.728-.118 1.14.87.425 1.02 1.438 3.523 1.565 3.78.127.257.212.555.042.889-.169.333-.255.54-.512.831-.257.291-.537.65-.768.873-.257.245-.524.512-.225 1.024.299.513 1.33 2.195 2.854 3.556 1.96 1.746 3.61 2.285 4.124 2.541.513.256.813.213 1.112-.128.299-.342 1.28-1.492 1.621-2.004.341-.513.682-.427 1.153-.256.471.171 2.983 1.406 3.496 1.662.513.256.854.384.983.598.127.213.127 1.237-.24 2.225z"/>
      </svg>
    </Button>
  );
};

export default WhatsAppFloat;
