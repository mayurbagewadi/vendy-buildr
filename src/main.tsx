import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeProducts } from "./lib/productData";
import { initializeSettings } from "./lib/settingsData";
import { syncFromGoogleSheets, getScriptUrl } from "./lib/googleSheetsSync";
import { saveProducts } from "./lib/productData";

// Initialize data on app start
const initializeApp = async () => {
  initializeSettings();
  
  // Try to sync from Google Sheets first
  const scriptUrl = getScriptUrl();
  if (scriptUrl) {
    try {
      console.log('Auto-syncing products from Google Sheets...');
      const response = await fetch(scriptUrl);
      if (response.ok) {
        const products = await response.json();
        if (products && products.length > 0) {
          saveProducts(products);
          console.log(`Successfully synced ${products.length} products from Google Sheets`);
        } else {
          // If no products in Google Sheets, use seed data
          initializeProducts();
        }
      } else {
        // If sync fails, use seed data
        initializeProducts();
      }
    } catch (error) {
      console.error('Failed to sync from Google Sheets, using local data:', error);
      initializeProducts();
    }
  } else {
    // If no script URL configured, use seed data
    initializeProducts();
  }
};

initializeApp();

createRoot(document.getElementById("root")!).render(<App />);
