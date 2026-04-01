// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createRoot } from "react-dom/client";
import { CommentReviewApp } from "./comment-review-app.tsx";
import "./comment-review-app.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<CommentReviewApp />);
