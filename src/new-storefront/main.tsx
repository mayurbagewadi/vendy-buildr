import { createRoot } from "react-dom/client";
import StorefrontApp from "./StorefrontApp";
import "../index.css";
import "./themes/ecosoap-boutique/theme.css";

createRoot(document.getElementById("root")!).render(<StorefrontApp />);
