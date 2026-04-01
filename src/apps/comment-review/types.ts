// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export type { ContentItem } from "../shared/types.ts";

/** Shape of the tool result payload sent from the server to the app. */
export interface CommentReviewPayload {
  workItemId: number;
  commentId: number;
  title: string;
  workItemType: string;
  workItemTypeColor?: string;
  comment: string;
  project: string;
  orgUrl?: string;
}

/** Action the user took in the review UI. */
export type ReviewAction = "updated" | "deleted";
