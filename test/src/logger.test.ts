// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { setLogLevel } from "@azure/logger";

jest.mock("@azure/logger", () => ({ setLogLevel: jest.fn() }));

describe("logger configuration", () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    if (originalLogLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = originalLogLevel;
  });

  it.each([
    ["verbose", "verbose"],
    ["debug", "info"],
    ["info", "info"],
    ["warning", "warning"],
    ["error", "error"],
    ["DEBUG", "info"],
  ])("maps LOG_LEVEL=%s to Azure logging level %s", async (level, expected) => {
    process.env.LOG_LEVEL = level;

    await jest.isolateModulesAsync(async () => {
      const { logger } = await import("../../src/logger");
      expect(logger.level).toBe(level);
      expect(logger.exitOnError).toBe(false);
      logger.close();
    });

    expect(setLogLevel).toHaveBeenCalledTimes(1);
    expect(setLogLevel).toHaveBeenCalledWith(expected);
  });

  it.each([undefined, "", "silly"])("does not configure Azure logging for LOG_LEVEL=%p", async (level) => {
    if (level === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = level;

    await jest.isolateModulesAsync(async () => {
      const { logger } = await import("../../src/logger");
      expect(logger.level).toBe(level || "info");
      logger.close();
    });

    expect(setLogLevel).not.toHaveBeenCalled();
  });
});
