import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, Screens } from "./App";
import { Palette } from "./Palette";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <StrictMode>
    <App>{import.meta.env.DEV && location.hash === "#palette" ? <Palette /> : <Screens />}</App>
  </StrictMode>
);
