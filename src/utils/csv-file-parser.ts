// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import csv from 'csv-parser';
import { Readable } from 'stream';

export interface ParsedTestCase {
  [key: string]: string | number | undefined;
}

export interface FileParseResult {
  data: ParsedTestCase[];
  headers: string[];
  errors: string[];
  warnings: string[];
}

export interface FileInput {
  content: string; // base64 encoded file content
  filename: string;
  mimeType?: string;
}

/**
 * Main function to parse uploaded files (Excel or CSV)
 */
export async function parseTestCaseFile(file: FileInput): Promise<FileParseResult> {
  const result: FileParseResult = {
    data: [],
    headers: [],
    errors: [],
    warnings: []
  };

  try {
    // Decode base64 content
    const buffer = Buffer.from(file.content, 'base64');

    // Reject Excel files explicitly (xlsx/xls) since xlsx support isnt there
    const lowerName = file.filename.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || file.mimeType?.includes('spreadsheet')) {
      result.errors.push('Excel file formats (.xlsx/.xls) are not supported. Please upload a CSV (.csv) file.');
      return result;
    }

    return await parseCsvFile(buffer, result);
  } catch (error) {
    result.errors.push(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Parse CSV file
 */
async function parseCsvFile(buffer: Buffer, result: FileParseResult): Promise<FileParseResult> {
  return new Promise((resolve) => {
    const rows: ParsedTestCase[] = [];
    let headers: string[] = [];
    let isFirstRow = true;

    const stream = Readable.from(buffer);
    
    stream
      .pipe(csv({ separator: ',' }))
      .on('headers', (headerList: string[]) => {
        headers = headerList.map(h => String(h).trim());
        result.headers = headers;
      })
      .on('data', (data: any) => {
        if (isFirstRow) {
          isFirstRow = false;
          // If headers weren't automatically detected, use first row as headers
          if (headers.length === 0) {
            headers = Object.keys(data);
            result.headers = headers;
            return;
          }
        }

        // Clean up the data
        const cleanData: ParsedTestCase = {};
        Object.keys(data).forEach(key => {
          const value = data[key];
          cleanData[key.trim()] = value !== undefined && value !== '' ? String(value).trim() : undefined;
        });

        // Only add non-empty rows
        if (Object.values(cleanData).some(v => v !== undefined && v !== '')) {
          rows.push(cleanData);
        }
      })
      .on('end', () => {
        result.data = rows;
        resolve(result);
      })
      .on('error', (error: Error) => {
        result.errors.push(`CSV parsing error: ${error.message}`);
        resolve(result);
      });
  });
}

/**
 * Validate parsed data for basic requirements
 */
export function validateParsedData(result: FileParseResult): FileParseResult {
  if (result.errors.length > 0) {
    return result; // Don't validate if there are already parsing errors
  }

  if (result.data.length === 0) {
    result.errors.push('No data rows found in file');
    return result;
  }

  if (result.headers.length === 0) {
    result.errors.push('No headers found in file');
    return result;
  }

  // Check if any rows have data
  const hasDataRows = result.data.some(row => 
    Object.values(row).some(value => value !== undefined && value !== '')
  );

  if (!hasDataRows) {
    result.errors.push('No valid data rows found');
    return result;
  }

  return result;
}