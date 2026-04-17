// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { buildHostedSearchUrl, buildIdentityApiBaseUrl, extractOrganizationNameFromServerUrl, resolveDeploymentContext } from "../../src/deployment";

describe("deployment helpers", () => {
  describe("resolveDeploymentContext", () => {
    it("resolves hosted context from organization name", () => {
      const context = resolveDeploymentContext("contoso");

      expect(context).toEqual({
        organizationInput: "contoso",
        organizationName: "contoso",
        organizationUrl: "https://dev.azure.com/contoso",
        isHosted: true,
      });
    });

    it("resolves hosted context from full dev.azure.com URL", () => {
      const context = resolveDeploymentContext("https://dev.azure.com/fabrikam/");

      expect(context).toEqual({
        organizationInput: "https://dev.azure.com/fabrikam/",
        organizationName: "fabrikam",
        organizationUrl: "https://dev.azure.com/fabrikam",
        isHosted: true,
      });
    });

    it("resolves on-prem context from server URL", () => {
      const context = resolveDeploymentContext("https://ado.contoso.local/tfs/DefaultCollection");

      expect(context).toEqual({
        organizationInput: "https://ado.contoso.local/tfs/DefaultCollection",
        organizationName: undefined,
        organizationUrl: "https://ado.contoso.local/tfs/DefaultCollection",
        isHosted: false,
      });
    });
  });

  describe("extractOrganizationNameFromServerUrl", () => {
    it("extracts organization from dev.azure.com URL", () => {
      expect(extractOrganizationNameFromServerUrl("https://dev.azure.com/contoso")).toBe("contoso");
    });

    it("extracts organization from visualstudio.com URL", () => {
      expect(extractOrganizationNameFromServerUrl("https://fabrikam.visualstudio.com")).toBe("fabrikam");
    });

    it("returns undefined for on-prem URL", () => {
      expect(extractOrganizationNameFromServerUrl("https://ado.contoso.local/tfs/DefaultCollection")).toBeUndefined();
    });
  });

  describe("buildIdentityApiBaseUrl", () => {
    it("uses hosted identity endpoint for Azure DevOps Services", () => {
      expect(buildIdentityApiBaseUrl("https://dev.azure.com/contoso")).toBe("https://vssps.dev.azure.com/contoso/_apis/identities");
    });

    it("uses server-relative identity endpoint for on-prem", () => {
      expect(buildIdentityApiBaseUrl("https://ado.contoso.local/tfs/DefaultCollection")).toBe("https://ado.contoso.local/tfs/DefaultCollection/_apis/identities");
    });
  });

  describe("buildHostedSearchUrl", () => {
    it("builds search endpoint for hosted org", () => {
      expect(buildHostedSearchUrl("https://dev.azure.com/contoso", "codesearchresults", "7.2-preview.1")).toBe(
        "https://almsearch.dev.azure.com/contoso/_apis/search/codesearchresults?api-version=7.2-preview.1"
      );
    });

    it("returns undefined for on-prem server URL", () => {
      expect(buildHostedSearchUrl("https://ado.contoso.local/tfs/DefaultCollection", "codesearchresults", "7.2-preview.1")).toBeUndefined();
    });
  });
});
