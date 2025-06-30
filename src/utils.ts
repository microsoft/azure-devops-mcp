// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { packageVersion } from "./version.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";
import AdmZip from "adm-zip";

export const apiVersion = "7.2-preview.1";
export const batchApiVersion = "5.0";
export const userAgent = `AzureDevOps.MCP/${packageVersion} (local)`


// Helper function to convert stream to buffer
export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Helper function to create unique filename and paths
export function createLogPaths(buildId: number): { filename: string; folderName: string; zipFilePath: string; extractDir: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `build-${buildId}-logs-${timestamp}.zip`;
  const folderName = `build-${buildId}-logs-${timestamp}`;
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const zipFilePath = path.join(downloadsDir, filename);
  const extractDir = path.join(downloadsDir, folderName);
  
  return { filename, folderName, zipFilePath, extractDir };
}

// Helper function to ensure downloads directory exists
export function ensureDownloadsDirectory(): string {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  return downloadsDir;
}

// Recursive function to extract nested ZIP files
export function extractNestedZips(dir: string): void {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      extractNestedZips(filePath);
    } else if (file.toLowerCase().endsWith('.zip')) {
      try {
        // Extract nested ZIP file
        const nestedZip = new AdmZip(filePath);
        const nestedExtractDir = path.join(dir, file.replace(/\.zip$/i, ''));
        
        // Create directory for nested extraction
        if (!fs.existsSync(nestedExtractDir)) {
          fs.mkdirSync(nestedExtractDir, { recursive: true });
        }
        
        // Extract nested ZIP
        nestedZip.extractAllTo(nestedExtractDir, true);
        
        // Remove the original ZIP file after extraction
        fs.unlinkSync(filePath);
        
        // Recursively check the newly extracted directory for more ZIPs
        extractNestedZips(nestedExtractDir);
      } catch (error) {
        console.warn(`Failed to extract nested ZIP file ${filePath}:`, error);
      }
    }
  }
}

// Helper function to create analysis prompt file
export function createAnalysisPrompt(extractDir: string, project: string, buildId: number): void {
  const promptFile = path.join(extractDir, 'ANALYSIS_PROMPT.txt');
  const promptContent = `BUILD LOG ANALYSIS GUIDE
========================

Build Information:
- Project: ${project}
- Build ID: ${buildId}
- Extracted: ${new Date().toISOString()}

Analysis Tasks:
1. Look for ERROR, FAILED, or EXCEPTION keywords in log files
2. Check pipeline YAML files for configuration issues
3. Examine test results and failure reports
4. Review dependency installation logs
5. Identify the exact failure point and error messages

Common File Types to Check:
- *.log - Build execution logs
- *.yml/*.yaml - Pipeline configuration
- *.xml - Test results (MSTest, NUnit, etc.)
- *.trx - Visual Studio test results
- *.json - Package.json, build configs
- **/logs/** - Nested log directories

Search Strategy:
Use VS Code search (Ctrl+Shift+F) to find:
- "error" (case insensitive)
- "failed" (case insensitive)
- "exception" (case insensitive)
- "##[error]" (Azure DevOps error marker)
- Exit codes: "exit code 1", "returned 1"
`;
  fs.writeFileSync(promptFile, promptContent);
}

// Helper function to open directory in VS Code
export function openInVSCode(extractDir: string): void {
  child_process.exec(`code "${extractDir}"`, (error) => {
    if (error) {
      console.warn('Could not open VS Code automatically. Please open the folder manually:', extractDir);
    }
  });
}

// Helper function to clean up ZIP file
export function cleanupZipFile(zipFilePath: string): void {
  try {
    fs.unlinkSync(zipFilePath);
  } catch (error) {
    console.warn('Could not remove original ZIP file:', error);
  }
}