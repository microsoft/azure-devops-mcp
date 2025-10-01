# Zod v4 Migration - Blocked by Upstream Dependency

## Summary

The Azure DevOps MCP server **cannot upgrade to Zod v4** at this time due to a dependency constraint with `@modelcontextprotocol/sdk`, which only supports Zod v3.

## Root Cause

The `@modelcontextprotocol/sdk` package (MCP SDK) has a hard dependency on Zod v3:

```json
{
  "dependencies": {
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.24.1"
  }
}
```

When attempting to upgrade to Zod v4:

1. **Direct Incompatibility**: The MCP SDK uses internal Zod APIs that changed in v4
2. **Type Mismatches**: Zod v4 schema types don't match the type signatures expected by the MCP SDK
3. **Build Failures**: TypeScript compilation fails with numerous type errors

## Evidence

### npm Install Failure

```
npm error peer zod@"^3.24.1" from zod-to-json-schema@3.24.6
npm error   zod-to-json-schema@"^3.24.5" from the root project
```

### TypeScript Build Errors

When Zod v4 is installed, the project fails to compile with errors like:

```
src/prompts.ts:25:85 - error TS2322: Type 'ZodString' is not assignable to type 'ZodType<string, ZodTypeDef, string> | ZodOptional<ZodType<string, ZodTypeDef, string>>'.
  Type 'ZodString' is missing the following properties from type 'ZodOptional<ZodType<string, ZodTypeDef, string>>': _parse, unwrap, _type, _getType, and 8 more.

src/tools/repositories.ts:101:10 - error TS2769: No overload matches this call.
  Type 'ZodString' is not assignable to type 'string | ZodTypeAny | undefined'.
    Type 'ZodString' is missing the following properties from type 'ZodType<any, any, any>': _type, _parse, _getType, _getOrReturnCtx, and 7 more.
```

## Upstream Issues

The MCP SDK maintainers are aware of this issue. There are several open issues tracking Zod v4 support:

- [modelcontextprotocol/typescript-sdk#925](https://github.com/modelcontextprotocol/typescript-sdk/issues/925) - MCP SDK v1.17.5 Incompatible with Zod v4 (63+ reactions)
- [modelcontextprotocol/typescript-sdk#555](https://github.com/modelcontextprotocol/typescript-sdk/issues/555) - Zod 4 supported (8+ reactions)
- [modelcontextprotocol/typescript-sdk#906](https://github.com/modelcontextprotocol/typescript-sdk/issues/906) - Zod version compatibility issue
- [modelcontextprotocol/typescript-sdk#745](https://github.com/modelcontextprotocol/typescript-sdk/issues/745) - JSON Schema draft compatibility

## What Needs to Happen

For Azure DevOps MCP to upgrade to Zod v4, the following must occur:

1. **MCP SDK Update**: The `@modelcontextprotocol/sdk` package must be updated to support Zod v4
   - Update internal Zod API usage
   - Update type definitions to be compatible with Zod v4
   - Either upgrade `zod-to-json-schema` or use Zod v4's native `toJSONSchema()` method

2. **Release New MCP SDK Version**: Once updated, a new version of the SDK must be published to npm

3. **Azure DevOps MCP Update**: Only then can we:
   - Update our dependency to the new MCP SDK version
   - Update Zod to v4
   - Test and verify everything works correctly

## Timeline

As of October 2025, there is no official timeline for Zod v4 support in the MCP SDK. The original PR #343 was closed on August 1, 2025 with the comment:

> "We are on latest default, this one requires more work to support zod v4. Closing it for now."

## Recommendation

**Do not attempt to upgrade to Zod v4 until the MCP SDK adds support for it.**

The current version (Zod ^3.25.63) is stable and receives security updates. We should:

1. Monitor the MCP SDK repository for Zod v4 support announcements
2. Update to the latest Zod v3 minor/patch versions as they're released
3. Revisit this upgrade once the MCP SDK supports Zod v4

## Related Files

- `package.json` - Contains Zod dependency version
- `src/tools/*.ts` - Tool definitions using Zod schemas
- `src/prompts.ts` - Prompt definitions using Zod schemas
- `test/src/enum-schema.test.ts` - Tests using `zod-to-json-schema`

## See Also

- [Zod v4 Release Notes](https://github.com/colinhacks/zod/releases/tag/v4.0.0)
- [Zod v4 Library Authors Guide](https://zod.dev/library-authors)
- [MCP SDK Repository](https://github.com/modelcontextprotocol/typescript-sdk)
