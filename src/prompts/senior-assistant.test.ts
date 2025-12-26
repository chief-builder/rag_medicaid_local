import { describe, it, expect } from 'vitest';
import {
  SENIOR_SYSTEM_PROMPT,
  SENIOR_ANSWER_FORMAT,
  formatContextForSeniors,
  generateUserPrompt,
  getFollowUpSuggestions,
  RESOURCES_FOOTER,
  NO_ANSWER_RESPONSE,
} from './senior-assistant.js';

describe('Senior Assistant Prompts', () => {
  describe('SENIOR_SYSTEM_PROMPT', () => {
    it('should include communication style guidelines', () => {
      expect(SENIOR_SYSTEM_PROMPT).toContain('clear, simple language');
      expect(SENIOR_SYSTEM_PROMPT).toContain('patient and thorough');
    });

    it('should list key Medicare/Medicaid programs', () => {
      expect(SENIOR_SYSTEM_PROMPT).toContain('QMB');
      expect(SENIOR_SYSTEM_PROMPT).toContain('SLMB');
      expect(SENIOR_SYSTEM_PROMPT).toContain('Extra Help');
      expect(SENIOR_SYSTEM_PROMPT).toContain('LIFE');
      expect(SENIOR_SYSTEM_PROMPT).toContain('CHC Waiver');
    });

    it('should include Chester County resources', () => {
      expect(SENIOR_SYSTEM_PROMPT).toContain('Chester County CAO');
      expect(SENIOR_SYSTEM_PROMPT).toContain('610-466-1000');
      expect(SENIOR_SYSTEM_PROMPT).toContain('APPRISE');
      expect(SENIOR_SYSTEM_PROMPT).toContain('610-344-6350');
    });

    it('should include citation instructions', () => {
      expect(SENIOR_SYSTEM_PROMPT).toContain('[N] notation');
      expect(SENIOR_SYSTEM_PROMPT).toContain('cite sources');
    });

    it('should warn about sensitive topics', () => {
      expect(SENIOR_SYSTEM_PROMPT).toContain('estate planning');
      expect(SENIOR_SYSTEM_PROMPT).toContain('asset transfers');
      expect(SENIOR_SYSTEM_PROMPT).toContain('professional help');
    });
  });

  describe('SENIOR_ANSWER_FORMAT', () => {
    it('should specify response structure', () => {
      expect(SENIOR_ANSWER_FORMAT).toContain('Direct Answer');
      expect(SENIOR_ANSWER_FORMAT).toContain('Program Information');
      expect(SENIOR_ANSWER_FORMAT).toContain('Next Steps');
      expect(SENIOR_ANSWER_FORMAT).toContain('Citations');
    });
  });

  describe('formatContextForSeniors', () => {
    it('should format single context with index and source', () => {
      const contexts = [
        {
          index: 1,
          content: 'QMB pays Medicare premiums.',
          filename: 'msp-guide.pdf',
          pageNumber: 5,
        },
      ];

      const result = formatContextForSeniors(contexts);
      expect(result).toContain('[1]');
      expect(result).toContain('msp-guide.pdf');
      expect(result).toContain('Page 5');
      expect(result).toContain('QMB pays Medicare premiums');
    });

    it('should format multiple contexts with separators', () => {
      const contexts = [
        { index: 1, content: 'First content', filename: 'doc1.pdf', pageNumber: 1 },
        { index: 2, content: 'Second content', filename: 'doc2.pdf' },
      ];

      const result = formatContextForSeniors(contexts);
      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
      expect(result).toContain('---');
      expect(result).toContain('First content');
      expect(result).toContain('Second content');
    });

    it('should handle missing page numbers', () => {
      const contexts = [
        { index: 1, content: 'Content', filename: 'doc.pdf' },
      ];

      const result = formatContextForSeniors(contexts);
      expect(result).not.toContain('Page');
      expect(result).toContain('doc.pdf');
    });
  });

  describe('generateUserPrompt', () => {
    it('should include context and question', () => {
      const query = 'What is QMB?';
      const context = '[1] Source: msp-guide.pdf\nQMB is a program...';

      const result = generateUserPrompt(query, context);
      expect(result).toContain(query);
      expect(result).toContain(context);
      expect(result).toContain('senior citizen');
    });

    it('should include answer format instructions', () => {
      const result = generateUserPrompt('Test query', 'Test context');
      expect(result).toContain('Direct Answer');
      expect(result).toContain('Citations');
    });
  });

  describe('getFollowUpSuggestions', () => {
    it('should return Medicare Savings suggestions for QMB queries', () => {
      const suggestions = getFollowUpSuggestions(['QMB', 'income limits']);
      expect(suggestions).toContain('Would you like to know how to apply for this program?');
    });

    it('should return nursing home suggestions for LTC queries', () => {
      const suggestions = getFollowUpSuggestions(['nursing home', 'spouse']);
      expect(suggestions).toContain('Would you like to know about home care alternatives?');
    });

    it('should return prescription suggestions for drug help queries', () => {
      const suggestions = getFollowUpSuggestions(['prescription', 'Extra Help']);
      expect(suggestions).toContain('Would you like to know about Extra Help/LIS?');
    });

    it('should return general suggestions for unknown topics', () => {
      const suggestions = getFollowUpSuggestions(['unknown topic']);
      expect(suggestions).toContain('Is there anything else you would like to know?');
    });
  });

  describe('RESOURCES_FOOTER', () => {
    it('should include key contact numbers', () => {
      expect(RESOURCES_FOOTER).toContain('610-466-1000');
      expect(RESOURCES_FOOTER).toContain('610-344-6350');
      expect(RESOURCES_FOOTER).toContain('1-800-274-3258');
    });

    it('should include COMPASS website', () => {
      expect(RESOURCES_FOOTER).toContain('compass.state.pa.us');
    });
  });

  describe('NO_ANSWER_RESPONSE', () => {
    it('should provide helpful alternatives when no answer is found', () => {
      expect(NO_ANSWER_RESPONSE).toContain('Chester County CAO');
      expect(NO_ANSWER_RESPONSE).toContain('APPRISE');
      expect(NO_ANSWER_RESPONSE).toContain('PHLP');
    });

    it('should offer to rephrase', () => {
      expect(NO_ANSWER_RESPONSE).toContain('rephrasing');
    });
  });
});
