// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { coerceBoolean } from "../../src/shared/zod-utils";

describe("coerceBoolean", () => {
  const schema = coerceBoolean();

  it('should coerce "true" string to true', () => {
    expect(schema.parse("true")).toBe(true);
  });

  it('should coerce "false" string to false', () => {
    expect(schema.parse("false")).toBe(false);
  });

  it("should pass through boolean true", () => {
    expect(schema.parse(true)).toBe(true);
  });

  it("should pass through boolean false", () => {
    expect(schema.parse(false)).toBe(false);
  });

  it("should reject non-boolean strings", () => {
    expect(() => schema.parse("yes")).toThrow();
    expect(() => schema.parse("1")).toThrow();
    expect(() => schema.parse("")).toThrow();
  });

  it("should reject other types", () => {
    expect(() => schema.parse(0)).toThrow();
    expect(() => schema.parse(1)).toThrow();
    expect(() => schema.parse(null)).toThrow();
    expect(() => schema.parse(undefined)).toThrow();
  });
});
