// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Re-export the shared PeoplePicker with work-items CSS class defaults.
import { PeoplePicker as SharedPeoplePicker } from "../../shared/people-picker.tsx";
import type { App } from "@modelcontextprotocol/ext-apps";

export function PeoplePicker({ value, onChange, app }: { value: string; onChange: (value: string) => void; app: App | undefined }) {
  return <SharedPeoplePicker value={value} onChange={onChange} app={app} className="people-picker" classPrefix="pp" inputClassName="edit-input" />;
}
