// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it } from "@jest/globals";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getEnumKeys } from "../../src/utils.js";
import { DefinitionQueryOrder, BuildQueryOrder, StageUpdateType } from "azure-devops-node-api/interfaces/BuildInterfaces.js";
import { ReleaseDefinitionExpands, ReleaseDefinitionQueryOrder, ReleaseStatus, ReleaseQueryOrder, ReleaseExpands } from "azure-devops-node-api/interfaces/ReleaseInterfaces.js";

interface EnumSchema {
  type: string;
  enum: string[];
}

describe("Enum Schema Generation", () => {
  describe("getEnumKeys utility", () => {
    it("should extract string keys from numeric enums", () => {
      const keys = getEnumKeys(DefinitionQueryOrder);
      expect(keys).toEqual(["None", "LastModifiedAscending", "LastModifiedDescending", "DefinitionNameAscending", "DefinitionNameDescending"]);
    });

    it("should extract string keys from BuildQueryOrder", () => {
      const keys = getEnumKeys(BuildQueryOrder);
      expect(keys).toEqual(["FinishTimeAscending", "FinishTimeDescending", "QueueTimeDescending", "QueueTimeAscending", "StartTimeDescending", "StartTimeAscending"]);
    });
  });

  describe("String enum schemas", () => {
    it("should generate string type schema for DefinitionQueryOrder", () => {
      const schema = z.enum(getEnumKeys(DefinitionQueryOrder) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["None", "LastModifiedAscending", "LastModifiedDescending", "DefinitionNameAscending", "DefinitionNameDescending"]);
    });

    it("should generate string type schema for BuildQueryOrder", () => {
      const schema = z.enum(getEnumKeys(BuildQueryOrder) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["FinishTimeAscending", "FinishTimeDescending", "QueueTimeDescending", "QueueTimeAscending", "StartTimeDescending", "StartTimeAscending"]);
    });

    it("should generate string type schema for StageUpdateType", () => {
      const schema = z.enum(getEnumKeys(StageUpdateType) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["Cancel", "Retry", "Run"]);
    });

    it("should generate string type schema for ReleaseDefinitionExpands", () => {
      const schema = z.enum(getEnumKeys(ReleaseDefinitionExpands) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["None", "Environments", "Artifacts", "Triggers", "Variables", "Tags", "LastRelease"]);
    });

    it("should generate string type schema for ReleaseDefinitionQueryOrder", () => {
      const schema = z.enum(getEnumKeys(ReleaseDefinitionQueryOrder) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["IdAscending", "IdDescending", "NameAscending", "NameDescending"]);
    });

    it("should generate string type schema for ReleaseStatus", () => {
      const schema = z.enum(getEnumKeys(ReleaseStatus) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["Undefined", "Draft", "Active", "Abandoned"]);
    });

    it("should generate string type schema for ReleaseQueryOrder", () => {
      const schema = z.enum(getEnumKeys(ReleaseQueryOrder) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["Descending", "Ascending"]);
    });

    it("should generate string type schema for ReleaseExpands", () => {
      const schema = z.enum(getEnumKeys(ReleaseExpands) as [string, ...string[]]);
      const jsonSchema = zodToJsonSchema(schema) as EnumSchema;

      expect(jsonSchema.type).toBe("string");
      expect(jsonSchema.enum).toEqual(["None", "Environments", "Artifacts", "Approvals", "ManualInterventions", "Variables", "Tags"]);
    });
  });

  describe("Enum value conversion", () => {
    it("should correctly convert string enum keys back to numeric values", () => {
      expect(DefinitionQueryOrder["None" as keyof typeof DefinitionQueryOrder]).toBe(0);
      expect(DefinitionQueryOrder["LastModifiedAscending" as keyof typeof DefinitionQueryOrder]).toBe(1);
      expect(BuildQueryOrder["QueueTimeDescending" as keyof typeof BuildQueryOrder]).toBe(4);
      expect(StageUpdateType["Retry" as keyof typeof StageUpdateType]).toBe(1);
      expect(ReleaseStatus["Active" as keyof typeof ReleaseStatus]).toBe(2);
    });
  });
});
