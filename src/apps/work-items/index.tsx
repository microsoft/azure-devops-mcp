// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createRoot } from "react-dom/client";
import { WorkItemsApp } from "./work-items-app.tsx";
import "./work-items-app.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<WorkItemsApp />);
