import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeSettings } from "./lib/settingsData";

// Initialize settings on app start
initializeSettings();

createRoot(document.getElementById("root")!).render(<App />);
