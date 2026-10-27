import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, Screens } from "./App";
import { Palette } from "./Palette";
import { getInstaller } from "./ui/install";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
// Listen from the start: Chrome can fire the install event before the first render.
getInstaller();

createRoot(root).render(
  <StrictMode>
    <App>{import.meta.env.DEV && location.hash === "#palette" ? <Palette /> : <Screens />}</App>
  </StrictMode>
);
