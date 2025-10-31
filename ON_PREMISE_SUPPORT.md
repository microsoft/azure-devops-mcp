# On-Premise Support Implementation

This document describes the changes made to add on-premise Azure DevOps Server / TFS support to the Microsoft Azure DevOps MCP Server.

## Summary

The Microsoft Azure DevOps MCP Server now supports both **Azure DevOps Services (cloud)** and **on-premise installations** (Azure DevOps Server / Team Foundation Server), matching the functionality of the Vortiago Python implementation.

## Changes Made

### 1. Modified `src/index.ts`

**Key Changes:**
- Added new `--url` (`-u`) command-line option for explicit on-premise URLs
- Updated `organization` parameter description to accept full URLs
- Implemented URL detection logic with three modes:
  1. **Explicit URL mode**: Using `--url` flag
  2. **Auto-detect mode**: Full URL in organization parameter (contains `://`)
  3. **Cloud mode**: Organization name only (backward compatible)

**Code Changes:**
```typescript
// Old implementation (lines 60-61)
export const orgName = argv.organization as string;
const orgUrl = "https://dev.azure.com/" + orgName;

// New implementation (lines 65-88)
let orgUrl: string;
let orgName: string;

if (argv.url) {
  // Explicit URL provided via --url option
  orgUrl = argv.url as string;
  const urlParts = orgUrl.replace(/\/$/, '').split('/');
  orgName = urlParts[urlParts.length - 1];
} else if ((argv.organization as string).includes('://')) {
  // Full URL provided in organization parameter (auto-detect)
  orgUrl = argv.organization as string;
  const urlParts = orgUrl.replace(/\/$/, '').split('/');
  orgName = urlParts[urlParts.length - 1];
} else {
  // Organization name only - use cloud URL (backward compatible)
  orgName = argv.organization as string;
  orgUrl = "https://dev.azure.com/" + orgName;
}
```

### 2. Updated `README.md`

**Additions:**
- Added new section "🏢 On-Premise / TFS Support"
- Updated table of contents
- Provided three configuration examples:
  - Option 1: Using `--url` flag (explicit)
  - Option 2: Full URL as organization parameter (auto-detect)
  - Option 3: Using MCP inputs (flexible)
- Documented common on-premise URL formats
- Clarified backward compatibility

### 3. Created Example Configuration

**File:** `.vscode/mcp.onpremise.example.json`

Provides ready-to-use examples for:
- On-premise with explicit `--url` flag
- On-premise with auto-detection
- On-premise with MCP input prompts
- Cloud configuration (backward compatible)

## Usage Examples

### Cloud (Backward Compatible)
```bash
npx -y @azure-devops/mcp contoso
# Equivalent to: https://dev.azure.com/contoso
```

### On-Premise - Explicit URL Flag
```bash
npx -y @azure-devops/mcp DefaultCollection --url https://tfs.company.com/DefaultCollection
```

### On-Premise - Auto-Detect
```bash
npx -y @azure-devops/mcp https://tfs.company.com/DefaultCollection
```

### Common On-Premise URL Patterns

- Azure DevOps Server: `https://devops.company.com/DefaultCollection`
- TFS 2018/2017: `https://tfs.company.com/tfs/DefaultCollection`
- Custom port: `https://tfs.company.com:8080/tfs/DefaultCollection`

## Testing Recommendations

1. **Cloud testing**: Verify backward compatibility with existing cloud configurations
2. **On-premise testing**: Test with actual TFS/Azure DevOps Server instances
3. **Edge cases**:
   - URLs with trailing slashes
   - URLs with custom ports
   - Collection-specific URLs
   - Authentication with on-premise servers

## Comparison with Vortiago Implementation

| Feature | Vortiago (Python) | Microsoft (TypeScript - Updated) |
|---------|-------------------|----------------------------------|
| Cloud support | ✅ Via env var | ✅ Via org name parameter |
| On-premise support | ✅ Via env var | ✅ Via `--url` or auto-detect |
| Configuration method | Environment variable | Command-line arguments |
| Auto-detection | ❌ | ✅ Detects `://` in org param |
| Backward compatible | N/A | ✅ Fully compatible |
| Multiple methods | ❌ Single method | ✅ Three methods |

## Benefits

1. **Parity with Vortiago**: Now supports on-premise installations
2. **Multiple configuration options**: Users can choose their preferred method
3. **Backward compatible**: Existing cloud configurations continue to work
4. **Auto-detection**: Smart URL detection reduces configuration complexity
5. **Well-documented**: Clear examples in README and example config files

## Next Steps

### For Local Testing
1. Build the project: `npm run build`
2. Test with on-premise URL: `node dist/index.js https://your-tfs-server/DefaultCollection`
3. Verify authentication works with your on-premise instance

### For Production
1. Consider contributing this change upstream to Microsoft repository
2. Request inclusion in the next release
3. Update npm package documentation once merged

## Migration Guide

### From Vortiago to Microsoft MCP Server (On-Premise)

**Vortiago Configuration:**
```bash
# .env file
AZURE_DEVOPS_PAT=your_pat_token
AZURE_DEVOPS_ORGANIZATION_URL=https://tfs.company.com/DefaultCollection
```

**Microsoft MCP Configuration:**
```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@azure-devops/mcp",
        "https://tfs.company.com/DefaultCollection",
        "-a",
        "env"
      ]
    }
  }
}
```

The PAT token should be set via environment variable `AZURE_DEVOPS_EXT_PAT` when using `-a env` authentication mode.

## Author

Implementation completed on: 2025-10-31
