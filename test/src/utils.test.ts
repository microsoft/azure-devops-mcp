// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AlertType, AlertValidityStatus, Confidence, Severity, State } from "azure-devops-node-api/interfaces/AlertInterfaces";
import { createEnumMapping, mapStringToEnum } from "../../src/utils";

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

    it("should apply custom key transform function", () => {
      const mapping = createEnumMapping(AlertType, (key) => key.toUpperCase());

      expect(mapping).toEqual({
        UNKNOWN: AlertType.Unknown,
        DEPENDENCY: AlertType.Dependency,
        SECRET: AlertType.Secret,
        CODE: AlertType.Code,
        LICENSE: AlertType.License,
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
    let alertTypeMapping: Record<string, AlertType>;

    beforeEach(() => {
      alertTypeMapping = createEnumMapping(AlertType);
    });

    describe("with AlertType enum", () => {
      it("should map valid string to correct enum value", () => {
        expect(mapStringToEnum("code", alertTypeMapping)).toBe(AlertType.Code);
        expect(mapStringToEnum("secret", alertTypeMapping)).toBe(AlertType.Secret);
        expect(mapStringToEnum("dependency", alertTypeMapping)).toBe(AlertType.Dependency);
        expect(mapStringToEnum("unknown", alertTypeMapping)).toBe(AlertType.Unknown);
      });

      it("should be case insensitive", () => {
        expect(mapStringToEnum("CODE", alertTypeMapping)).toBe(AlertType.Code);
        expect(mapStringToEnum("Code", alertTypeMapping)).toBe(AlertType.Code);
        expect(mapStringToEnum("cOdE", alertTypeMapping)).toBe(AlertType.Code);
      });

      it("should return default value for invalid strings", () => {
        expect(mapStringToEnum("invalid", alertTypeMapping, AlertType.Unknown)).toBe(AlertType.Unknown);
        expect(mapStringToEnum("nonexistent", alertTypeMapping, AlertType.Code)).toBe(AlertType.Code);
      });

      it("should return undefined for invalid strings without default", () => {
        expect(mapStringToEnum("invalid", alertTypeMapping)).toBeUndefined();
        expect(mapStringToEnum("nonexistent", alertTypeMapping)).toBeUndefined();
      });
    });

    describe("edge cases", () => {
      it("should handle undefined input", () => {
        expect(mapStringToEnum(undefined, alertTypeMapping)).toBeUndefined();
        expect(mapStringToEnum(undefined, alertTypeMapping, AlertType.Unknown)).toBe(AlertType.Unknown);
      });

      it("should handle empty string", () => {
        expect(mapStringToEnum("", alertTypeMapping)).toBeUndefined();
        expect(mapStringToEnum("", alertTypeMapping, AlertType.Unknown)).toBe(AlertType.Unknown);
      });

      it("should handle whitespace strings", () => {
        expect(mapStringToEnum("   ", alertTypeMapping)).toBeUndefined();
        expect(mapStringToEnum("code ", alertTypeMapping)).toBeUndefined(); // Exact match required
      });

      it("should work with empty mapping", () => {
        const emptyMapping: Record<string, AlertType> = {};
        expect(mapStringToEnum("code", emptyMapping)).toBeUndefined();
        expect(mapStringToEnum("code", emptyMapping, AlertType.Unknown)).toBe(AlertType.Unknown);
      });
    });
  });

  describe("integration tests", () => {
    it("should work together to map strings to enums", () => {
      // Create mapping and use it to map strings
      const confidenceMapping = createEnumMapping(Confidence);

      expect(mapStringToEnum("high", confidenceMapping)).toBe(Confidence.High);
      expect(mapStringToEnum("other", confidenceMapping)).toBe(Confidence.Other);
      expect(mapStringToEnum("invalid", confidenceMapping, Confidence.Other)).toBe(Confidence.Other);
    });

    it("should handle array of strings mapping to array of enums", () => {
      const stateMapping = createEnumMapping(State);
      const inputStates = ["active", "dismissed", "unknown"];

      const mappedStates = inputStates.map((state) => mapStringToEnum(state, stateMapping, State.Unknown));

      expect(mappedStates).toEqual([State.Active, State.Dismissed, State.Unknown]);
    });

    it("should handle mixed case and invalid values in array", () => {
      const severityMapping = createEnumMapping(Severity);
      const inputSeverities = ["HIGH", "invalid", "low", "CRITICAL"];

      const mappedSeverities = inputSeverities.map((severity) => mapStringToEnum(severity, severityMapping, Severity.Undefined));

      expect(mappedSeverities).toEqual([
        Severity.High,
        Severity.Undefined, // invalid mapped to default
        Severity.Low,
        Severity.Critical,
      ]);
    });
  });
});
