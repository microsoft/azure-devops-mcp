// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AlertType, AlertValidityStatus, Confidence, Severity, State } from "azure-devops-node-api/interfaces/AlertInterfaces";
import { createEnumMapping, encodeFormattedValue, getEnumKeys, mapStringArrayToEnum, mapStringToEnum, safeEnumConvert } from "../../src/utils";

describe("utils", () => {
  describe("createEnumMapping", () => {
    it("should create lowercase mapping for AlertType enum", () => {
      const mapping = createEnumMapping(AlertType);

      expect(mapping).toEqual({
        unknown: AlertType.Unknown,
        dependency: AlertType.Dependency,
        secret: AlertType.Secret,
        code: AlertType.Code,
        license: AlertType.License,
      });
    });

    it("should create lowercase mapping for State enum", () => {
      const mapping = createEnumMapping(State);

      expect(mapping).toEqual({
        unknown: State.Unknown,
        active: State.Active,
        dismissed: State.Dismissed,
        fixed: State.Fixed,
        autodismissed: State.AutoDismissed,
      });
    });

    it("should create lowercase mapping for Severity enum", () => {
      const mapping = createEnumMapping(Severity);

      expect(mapping).toEqual({
        low: Severity.Low,
        medium: Severity.Medium,
        high: Severity.High,
        critical: Severity.Critical,
        note: Severity.Note,
        warning: Severity.Warning,
        error: Severity.Error,
        undefined: Severity.Undefined,
      });
    });

    it("should create lowercase mapping for Confidence enum", () => {
      const mapping = createEnumMapping(Confidence);

      expect(mapping).toEqual({
        high: Confidence.High,
        other: Confidence.Other,
      });
    });

    it("should create lowercase mapping for AlertValidityStatus enum", () => {
      const mapping = createEnumMapping(AlertValidityStatus);

      expect(mapping).toEqual({
        unknown: AlertValidityStatus.Unknown,
        active: AlertValidityStatus.Active,
        inactive: AlertValidityStatus.Inactive,
        none: AlertValidityStatus.None,
      });
    });

    it("should handle empty enum object", () => {
      const emptyEnum = {};
      const mapping = createEnumMapping(emptyEnum);

      expect(mapping).toEqual({});
    });

    it("should ignore numeric values in enum object", () => {
      // TypeScript numeric enums have reverse mappings (0: 'Unknown', Unknown: 0)
      // We only want the string keys mapping to numeric values
      const mapping = createEnumMapping(AlertType);

      // Should not contain reverse mappings like "0", "1", etc.
      expect(mapping["0"]).toBeUndefined();
      expect(mapping["1"]).toBeUndefined();
      expect(mapping["2"]).toBeUndefined();
      expect(mapping["3"]).toBeUndefined();
    });
  });

  describe("mapStringToEnum", () => {
    describe("with AlertType enum", () => {
      it("should map valid string to correct enum value", () => {
        expect(mapStringToEnum("code", AlertType)).toBe(AlertType.Code);
        expect(mapStringToEnum("secret", AlertType)).toBe(AlertType.Secret);
        expect(mapStringToEnum("dependency", AlertType)).toBe(AlertType.Dependency);
        expect(mapStringToEnum("unknown", AlertType)).toBe(AlertType.Unknown);
      });

      it("should be case insensitive", () => {
        expect(mapStringToEnum("CODE", AlertType)).toBe(AlertType.Code);
        expect(mapStringToEnum("Code", AlertType)).toBe(AlertType.Code);
        expect(mapStringToEnum("cOdE", AlertType)).toBe(AlertType.Code);
      });

      it("should return default value for invalid strings", () => {
        expect(mapStringToEnum("invalid", AlertType, AlertType.Unknown)).toBe(AlertType.Unknown);
        expect(mapStringToEnum("nonexistent", AlertType, AlertType.Code)).toBe(AlertType.Code);
      });

      it("should return undefined for invalid strings without default", () => {
        expect(mapStringToEnum("invalid", AlertType)).toBeUndefined();
        expect(mapStringToEnum("nonexistent", AlertType)).toBeUndefined();
      });
    });

    describe("edge cases", () => {
      it("should handle undefined input", () => {
        expect(mapStringToEnum(undefined, AlertType)).toBeUndefined();
        expect(mapStringToEnum(undefined, AlertType, AlertType.Unknown)).toBe(AlertType.Unknown);
      });

      it("should handle empty string", () => {
        expect(mapStringToEnum("", AlertType)).toBeUndefined();
        expect(mapStringToEnum("", AlertType, AlertType.Unknown)).toBe(AlertType.Unknown);
      });

      it("should handle whitespace strings", () => {
        expect(mapStringToEnum("   ", AlertType)).toBeUndefined();
        expect(mapStringToEnum("code ", AlertType)).toBeUndefined(); // Exact match required
      });

      it("should work with empty enum object", () => {
        const emptyEnum = {};
        expect(mapStringToEnum("code", emptyEnum)).toBeUndefined();
        expect(mapStringToEnum("code", emptyEnum, undefined)).toBeUndefined();
      });
    });
  });

  describe("mapStringArrayToEnum", () => {
    describe("with AlertType enum", () => {
      it("should map valid string array to enum array", () => {
        const input = ["code", "secret", "dependency"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code, AlertType.Secret, AlertType.Dependency]);
      });

      it("should be case insensitive", () => {
        const input = ["CODE", "Secret", "dEpEnDeNcY"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code, AlertType.Secret, AlertType.Dependency]);
      });

      it("should filter out invalid values", () => {
        const input = ["code", "invalid", "secret", "nonexistent", "dependency"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code, AlertType.Secret, AlertType.Dependency]);
      });

      it("should handle mixed valid and invalid values", () => {
        const input = ["unknown", "invalidtype", "code", "", "secret"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Unknown, AlertType.Code, AlertType.Secret]);
      });
    });

    describe("with State enum", () => {
      it("should map valid states correctly", () => {
        const input = ["active", "dismissed", "fixed"];
        const result = mapStringArrayToEnum(input, State);

        expect(result).toEqual([State.Active, State.Dismissed, State.Fixed]);
      });

      it("should handle all valid state values", () => {
        const input = ["unknown", "active", "dismissed", "fixed", "autodismissed"];
        const result = mapStringArrayToEnum(input, State);

        expect(result).toEqual([State.Unknown, State.Active, State.Dismissed, State.Fixed, State.AutoDismissed]);
      });
    });

    describe("with Severity enum", () => {
      it("should map severity levels correctly", () => {
        const input = ["critical", "high", "medium", "low"];
        const result = mapStringArrayToEnum(input, Severity);

        expect(result).toEqual([Severity.Critical, Severity.High, Severity.Medium, Severity.Low]);
      });

      it("should handle special severity values", () => {
        const input = ["note", "warning", "error", "undefined"];
        const result = mapStringArrayToEnum(input, Severity);

        expect(result).toEqual([Severity.Note, Severity.Warning, Severity.Error, Severity.Undefined]);
      });
    });

    describe("edge cases", () => {
      it("should handle undefined input", () => {
        const result = mapStringArrayToEnum(undefined, AlertType);

        expect(result).toEqual([]);
      });

      it("should handle empty array", () => {
        const result = mapStringArrayToEnum([], AlertType);

        expect(result).toEqual([]);
      });

      it("should handle array with only invalid values", () => {
        const input = ["invalid", "nonexistent", "badvalue"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([]);
      });

      it("should handle array with empty strings", () => {
        const input = ["", "   ", "code", ""];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code]);
      });

      it("should handle array with whitespace-only strings", () => {
        const input = ["code", "   ", "\t", "\n", "secret"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code, AlertType.Secret]);
      });

      it("should preserve order of valid values", () => {
        const input = ["secret", "invalid", "code", "badvalue", "dependency"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Secret, AlertType.Code, AlertType.Dependency]);
      });

      it("should handle duplicate values", () => {
        const input = ["code", "secret", "code", "dependency", "secret"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code, AlertType.Secret, AlertType.Code, AlertType.Dependency, AlertType.Secret]);
      });
    });

    describe("with different enum types", () => {
      it("should work with Confidence enum", () => {
        const input = ["high", "other"];
        const result = mapStringArrayToEnum(input, Confidence);

        expect(result).toEqual([Confidence.High, Confidence.Other]);
      });

      it("should work with AlertValidityStatus enum", () => {
        const input = ["active", "inactive", "unknown", "none"];
        const result = mapStringArrayToEnum(input, AlertValidityStatus);

        expect(result).toEqual([AlertValidityStatus.Active, AlertValidityStatus.Inactive, AlertValidityStatus.Unknown, AlertValidityStatus.None]);
      });
    });

    describe("performance and edge cases", () => {
      it("should handle large arrays efficiently", () => {
        const largeInput = Array(1000).fill("code");
        const result = mapStringArrayToEnum(largeInput, AlertType);

        expect(result).toHaveLength(1000);
        expect(result.every((item) => item === AlertType.Code)).toBe(true);
      });

      it("should handle array with null and undefined-like strings", () => {
        const input = ["null", "undefined", "code", "NaN"];
        const result = mapStringArrayToEnum(input, AlertType);

        expect(result).toEqual([AlertType.Code]);
      });
    });
  });

  describe("integration tests", () => {
    it("should work together to map strings to enums", () => {
      // Test using the new direct enum object API
      expect(mapStringToEnum("high", Confidence)).toBe(Confidence.High);
      expect(mapStringToEnum("other", Confidence)).toBe(Confidence.Other);
      expect(mapStringToEnum("invalid", Confidence, Confidence.Other)).toBe(Confidence.Other);
    });

    it("should handle array of strings mapping to array of enums", () => {
      const inputStates = ["active", "dismissed", "unknown"];

      const mappedStates = inputStates.map((state) => mapStringToEnum(state, State, State.Unknown));

      expect(mappedStates).toEqual([State.Active, State.Dismissed, State.Unknown]);
    });

    it("should handle mixed case and invalid values in array", () => {
      const inputSeverities = ["HIGH", "invalid", "low", "CRITICAL"];

      const mappedSeverities = inputSeverities.map((severity) => mapStringToEnum(severity, Severity, Severity.Undefined));

      expect(mappedSeverities).toEqual([
        Severity.High,
        Severity.Undefined, // invalid mapped to default
        Severity.Low,
        Severity.Critical,
      ]);
    });

    it("should demonstrate mapStringArrayToEnum vs individual mapStringToEnum calls", () => {
      const inputStates = ["active", "invalid", "dismissed", "badvalue", "fixed"];

      // Using mapStringArrayToEnum (filters out invalid values)
      const arrayResult = mapStringArrayToEnum(inputStates, State);

      // Using individual mapStringToEnum calls with default (keeps all positions)
      const individualResult = inputStates.map((state) => mapStringToEnum(state, State, State.Unknown));

      expect(arrayResult).toEqual([State.Active, State.Dismissed, State.Fixed]);
      expect(individualResult).toEqual([
        State.Active,
        State.Unknown, // invalid mapped to default
        State.Dismissed,
        State.Unknown, // badvalue mapped to default
        State.Fixed,
      ]);
    });

    it("should work with mapStringArrayToEnum for practical Azure DevOps scenarios", () => {
      // Simulating API input that might have mixed case and invalid values
      const alertTypes = ["CODE", "invalid", "Secret", "DEPENDENCY", "badtype"];
      const severities = ["CRITICAL", "unknown_severity", "high", "MEDIUM"];
      const states = ["Active", "dismissed", "FIXED", "invalid_state"];

      const mappedAlertTypes = mapStringArrayToEnum(alertTypes, AlertType);
      const mappedSeverities = mapStringArrayToEnum(severities, Severity);
      const mappedStates = mapStringArrayToEnum(states, State);

      expect(mappedAlertTypes).toEqual([AlertType.Code, AlertType.Secret, AlertType.Dependency]);
      expect(mappedSeverities).toEqual([Severity.Critical, Severity.High, Severity.Medium]);
      expect(mappedStates).toEqual([State.Active, State.Dismissed, State.Fixed]);
    });
  });

  describe("getEnumKeys", () => {
    it("should return string keys from a numeric enum", () => {
      const keys = getEnumKeys(AlertType);
      expect(keys).toEqual(["Unknown", "Dependency", "Secret", "Code", "License"]);
    });

    it("should filter out numeric keys", () => {
      // Create a mock enum with numeric keys (similar to TypeScript's reverse mappings)
      const mockEnum = {
        A: 0,
        B: 1,
        C: 2,
        0: "A", // Reverse mapping
        1: "B", // Reverse mapping
        2: "C", // Reverse mapping
      };

      const keys = getEnumKeys(mockEnum);
      expect(keys).toEqual(["A", "B", "C"]);
    });

    it("should handle empty enum object", () => {
      const keys = getEnumKeys({});
      expect(keys).toEqual([]);
    });

    it("should work with different enum types", () => {
      expect(getEnumKeys(State)).toEqual(["Unknown", "Active", "Dismissed", "Fixed", "AutoDismissed"]);
      expect(getEnumKeys(Severity)).toEqual(["Low", "Medium", "High", "Critical", "Note", "Warning", "Error", "Undefined"]);
      expect(getEnumKeys(Confidence)).toEqual(["High", "Other"]);
    });
  });

  describe("safeEnumConvert", () => {
    it("should convert valid enum string keys to values", () => {
      expect(safeEnumConvert(AlertType, "Code")).toBe(AlertType.Code);
      expect(safeEnumConvert(AlertType, "Secret")).toBe(AlertType.Secret);
      expect(safeEnumConvert(AlertType, "Unknown")).toBe(AlertType.Unknown);
    });

    it("should return undefined for invalid keys", () => {
      expect(safeEnumConvert(AlertType, "InvalidKey")).toBeUndefined();
      expect(safeEnumConvert(AlertType, "code")).toBeUndefined(); // Case sensitive
      expect(safeEnumConvert(AlertType, "SECRET")).toBeUndefined(); // Case sensitive
    });

    it("should handle undefined input", () => {
      expect(safeEnumConvert(AlertType, undefined)).toBeUndefined();
    });

    it("should handle empty string", () => {
      expect(safeEnumConvert(AlertType, "")).toBeUndefined();
    });

    it("should work with numeric enums", () => {
      expect(safeEnumConvert(State, "Active")).toBe(State.Active);
      expect(safeEnumConvert(State, "Dismissed")).toBe(State.Dismissed);
      expect(safeEnumConvert(State, "Fixed")).toBe(State.Fixed);
    });

    it("should respect case sensitivity", () => {
      // This differs from mapStringToEnum which is case-insensitive
      expect(safeEnumConvert(State, "active")).toBeUndefined();
      expect(safeEnumConvert(State, "ACTIVE")).toBeUndefined();
      expect(safeEnumConvert(State, "Active")).toBe(State.Active);
    });

    it("should work with empty enum", () => {
      expect(safeEnumConvert({}, "anyKey")).toBeUndefined();
    });

    it("should validate against enum keys", () => {
      // Create a mock enum with numeric keys (similar to TypeScript's reverse mappings)
      const mockEnum = {
        A: 0,
        B: 1,
        0: "A", // Reverse mapping
        1: "B", // Reverse mapping
      };

      expect(safeEnumConvert(mockEnum, "A")).toBe(0);
      expect(safeEnumConvert(mockEnum, "B")).toBe(1);
      expect(safeEnumConvert(mockEnum, "0")).toBeUndefined(); // Numeric strings aren't valid keys
    });
  });
});

describe("encodeFormattedValue", () => {
  describe("basic encoding behavior (always encode in Markdown)", () => {
    it("encodes angle brackets and dollar signs", () => {
      const input = "Value <x> $var > end";
      const result = encodeFormattedValue(input, "Markdown");
      expect(result).toBe("Value &lt;x&gt; $var &gt; end");
    });

    it("does nothing for Html format", () => {
      const input = "Value <x> $var > end";
      const result = encodeFormattedValue(input, "Html");
      expect(result).toBe(input);
    });

    it("returns original when format undefined", () => {
      const input = "<raw> $";
      expect(encodeFormattedValue(input)).toBe(input);
    });

    it("handles empty/null/undefined", () => {
      expect(encodeFormattedValue("", "Markdown")).toBe("");
      expect(encodeFormattedValue(null as unknown as string, "Markdown")).toBe(null);
      expect(encodeFormattedValue(undefined as unknown as string, "Markdown")).toBe(undefined);
    });
  });

  describe("idempotence and entity protection", () => {
    it("does not double encode entities", () => {
      const input = "Already &lt;tag&gt; plus <new> and $cash";
      const once = encodeFormattedValue(input, "Markdown");
      const twice = encodeFormattedValue(once, "Markdown");
      expect(once).toBe("Already &lt;tag&gt; plus &lt;new&gt; and $cash");
      expect(twice).toBe(once);
    });
  });
});
