// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export let orgUrl: string = "";
export let orgName: string = "";
export let isCustomUrl: boolean = false;
export let insecure: boolean = false;

export function setConfig(name: string, url: string, custom: boolean, insecure: boolean) {
  orgName = name;
  orgUrl = url;
  isCustomUrl = custom;
  insecure = insecure;
}
