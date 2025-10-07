import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeProducts } from "./lib/productData";
import { initializeSettings } from "./lib/settingsData";

// Initialize data on app start
initializeProducts();
initializeSettings();

createRoot(document.getElementById("root")!).render(<App />);
