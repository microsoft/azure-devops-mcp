// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { suggestUnifiedFieldMapping, AdoFieldDefinition } from '../../../src/utils/test-case-mapper.js';

describe('Unified Field Mapping Suggestions', () => {
  const adoFields: AdoFieldDefinition[] = [
    { referenceName: 'System.Title', name: 'Title' },
    { referenceName: 'System.Id', name: 'ID' },
    { referenceName: 'Microsoft.VSTS.TCM.Steps', name: 'Steps' },
    { referenceName: 'Microsoft.VSTS.Common.Priority', name: 'Priority' },
    { referenceName: 'System.AreaPath', name: 'Area Path' },
    { referenceName: 'Custom.RiskLevel', name: 'Risk Level' },
  ];

  it('maps plural and synonym headers to System.Title', () => {
    const headers = ['titles'];
    const result = suggestUnifiedFieldMapping(headers, adoFields);
    expect(result.suggestedMapping['titles']).toBe('System.Title');
  });

  it('suggests custom field mapping', () => {
    const headers = ['Risk Level'];
    const result = suggestUnifiedFieldMapping(headers, adoFields);
    expect(result.suggestedMapping['Risk Level']).toBe('Custom.RiskLevel');
  });

  it('includes candidate list for ambiguous headers', () => {
    const headers = ['prio']; // close to Priority
    const result = suggestUnifiedFieldMapping(headers, adoFields);
    const suggestion = result.suggestions.find(s => s.header === 'prio');
    expect(suggestion).toBeDefined();
    expect(suggestion?.candidates || suggestion?.suggestedReferenceName).toBeDefined();
  });
});
