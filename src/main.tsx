import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeProducts } from "./lib/productData";

// Initialize products with seed data if none exist
initializeProducts();

createRoot(document.getElementById("root")!).render(<App />);
