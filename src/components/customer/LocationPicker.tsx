import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LocationPickerProps {
  onLocationSelect: (latitude: number, longitude: number) => void;
  enabled?: boolean;
}

export function LocationPicker({ onLocationSelect, enabled = true }: LocationPickerProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGetLocation = () => {
    if (!enabled) {
      toast({
        title: "Feature Not Available",
        description: "Location sharing is not enabled in your current subscription plan",
        variant: "destructive",
      });
      return;
    }

    if (!navigator.geolocation) {
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationSelect(latitude, longitude);
        toast({
          title: "Location Captured",
          description: "Your location has been added to the order",
        });
        setIsLoading(false);
      },
      (error) => {
        let message = "Failed to get location";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Please enable location access in your browser settings.";
        }
        toast({
          title: "Location Error",
          description: message,
          variant: "destructive",
        });
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  if (!enabled) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGetLocation}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Getting Location...
        </>
      ) : (
        <>
          <MapPin className="h-4 w-4 mr-2" />
          Share My Current Location
        </>
      )}
    </Button>
  );
}
