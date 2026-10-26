import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Lab } from "./lab/Lab";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <StrictMode>
    <Lab />
  </StrictMode>
);
