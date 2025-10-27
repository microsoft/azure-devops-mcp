// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { parseTestCaseFile, validateParsedData, FileInput } from '../../../src/utils/csv-file-parser.js';
import { mapTestCasesFromData, createHeaderMapping } from '../../../src/utils/test-case-mapper.js';
const { FIELD_MAPPINGS_FALLBACK } = require('../../../src/utils/test-case-mapper.js');

describe('File Parsers', () => {
  describe('parseTestCaseFile', () => {
    it('should handle empty file content', async () => {
      const fileInput: FileInput = {
        content: '',
        filename: 'test.csv'
      };

      const result = await parseTestCaseFile(fileInput);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.data.length).toBe(0);
    });

    it('should handle invalid base64 content', async () => {
      const fileInput: FileInput = {
        content: 'invalid-base64',
        filename: 'test.csv'
      };

      const result = await parseTestCaseFile(fileInput);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should parse CSV content correctly', async () => {
      const csvContent = 'Title,Steps,Priority\nTest Case 1,Step 1|Expected 1,1\nTest Case 2,Step 2|Expected 2,2';
      const base64Content = Buffer.from(csvContent).toString('base64');

      const fileInput: FileInput = {
        content: base64Content,
        filename: 'test.csv'
      };

      const result = await parseTestCaseFile(fileInput);
      expect(result.errors.length).toBe(0);
      expect(result.data.length).toBe(2);
      expect(result.headers).toEqual(['Title', 'Steps', 'Priority']);
      expect(result.data[0]['Title']).toBe('Test Case 1');
    });
  });

  describe('validateParsedData', () => {
    it('should pass validation for valid data', () => {
      const validResult = {
        data: [{ Title: 'Test Case 1', Steps: 'Step 1' }],
        headers: ['Title', 'Steps'],
        errors: [],
        warnings: []
      };

      const result = validateParsedData(validResult);
      expect(result.errors.length).toBe(0);
    });

    it('should fail validation for empty data', () => {
      const emptyResult = {
        data: [],
        headers: ['Title'],
        errors: [],
        warnings: []
      };

      const result = validateParsedData(emptyResult);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No data rows found');
    });

    it('should fail validation for missing headers', () => {
      const noHeadersResult = {
        data: [{ Title: 'Test' }],
        headers: [],
        errors: [],
        warnings: []
      };

      const result = validateParsedData(noHeadersResult);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('No headers found');
    });
  });
});

describe('Test Case Mapper', () => {
  describe('createHeaderMapping', () => {
    it('should map standard headers correctly', () => {
      const headers = ['Title', 'Test Steps', 'Priority', 'Area Path'];
      // Import FIELD_MAPPINGS_FALLBACK from the implementation file
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mapping = createHeaderMapping(headers, FIELD_MAPPINGS_FALLBACK);

      expect(mapping.get('title')).toBe('Title');
      expect(mapping.get('steps')).toBe('Test Steps');
      expect(mapping.get('priority')).toBe('Priority');
      expect(mapping.get('areaPath')).toBe('Area Path');
    });

    it('should handle case-insensitive mapping', () => {
      const headers = ['TITLE', 'test case name', 'PRI'];
      const mapping = createHeaderMapping(headers, FIELD_MAPPINGS_FALLBACK);

      expect(mapping.get('title')).toBe('TITLE');
      expect(mapping.get('priority')).toBe('PRI');
    });

    it('should handle alternative header names', () => {
      const headers = ['Test Case Name', 'Actions', 'TestCaseId'];
      const mapping = createHeaderMapping(headers, FIELD_MAPPINGS_FALLBACK);

      expect(mapping.get('title')).toBe('Test Case Name');
      expect(mapping.get('steps')).toBe('Actions');
      expect(mapping.get('id')).toBe('TestCaseId');
    });
  });

  describe('mapTestCasesFromData', () => {
    it('should map valid test cases correctly', () => {
      const data = [
        { Title: 'Test Case 1', Priority: '1', Steps: 'Step 1|Expected 1' },
        { Title: 'Test Case 2', Priority: '2', TestCaseId: '123' }
      ];
      const headers = ['Title', 'Priority', 'Steps', 'TestCaseId'];

      const result = mapTestCasesFromData(data, headers);

      expect(result.errors.length).toBe(0);
      expect(result.mappedTestCases.length).toBe(2);
      expect(result.mappedTestCases[0].title).toBe('Test Case 1');
      expect(result.mappedTestCases[0].priority).toBe(1);
      expect(result.mappedTestCases[1].id).toBe(123);
      expect(result.stats.validRows).toBe(2);
      expect(result.stats.rowsWithId).toBe(1);
      expect(result.stats.rowsWithoutId).toBe(1);
    });

    it('should skip rows without title', () => {
      const data = [
        { Title: 'Valid Test Case', Priority: '1' },
        { Title: '', Priority: '2' },
        { Priority: '3' }
      ];
      const headers = ['Title', 'Priority'];

      const result = mapTestCasesFromData(data, headers);

      expect(result.mappedTestCases.length).toBe(1);
      expect(result.mappedTestCases[0].title).toBe('Valid Test Case');
    });

    it('should handle missing title field', () => {
      const data = [{ Steps: 'Some steps', Priority: '1' }];
      const headers = ['Steps', 'Priority'];

      const result = mapTestCasesFromData(data, headers);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Required field 'Title' not found");
    });

    it('should handle invalid priority values', () => {
      const data = [
        { Title: 'Test 1', Priority: 'high' },
        { Title: 'Test 2', Priority: '5' },
        { Title: 'Test 3', Priority: '2' }
      ];
      const headers = ['Title', 'Priority'];

      const result = mapTestCasesFromData(data, headers);

      expect(result.mappedTestCases.length).toBe(3);
      expect(result.mappedTestCases[0].priority).toBeUndefined(); // 'high' is not a valid number
      expect(result.mappedTestCases[1].priority).toBeUndefined(); // 5 is out of range (1-4)
      expect(result.mappedTestCases[2].priority).toBe(2); // Valid priority
    });

    it('should handle different ID formats', () => {
      const data = [
        { Title: 'Test 1', ID: '123' },
        { Title: 'Test 2', ID: 456 },
        { Title: 'Test 3', ID: 'invalid' }
      ];
      const headers = ['Title', 'ID'];

      const result = mapTestCasesFromData(data, headers);

      expect(result.mappedTestCases.length).toBe(3);
      expect(result.mappedTestCases[0].id).toBe(123); // String number converted
      expect(result.mappedTestCases[1].id).toBe(456); // Number preserved
      expect(result.mappedTestCases[2].id).toBe('invalid'); // Invalid number kept as string
    });
  });
});