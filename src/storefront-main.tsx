import { createRoot } from "react-dom/client";
import StorefrontApp from "./StorefrontApp.tsx";
import "./index.css";
import { installStorefrontDebug } from "@/lib/storefrontDebug";

installStorefrontDebug();

createRoot(document.getElementById("root")!).render(<StorefrontApp />);
