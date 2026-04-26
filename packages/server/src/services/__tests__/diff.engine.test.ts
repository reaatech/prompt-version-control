import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../diff.engine.js';

describe('DiffEngine', () => {
  const engine = new DiffEngine();

  describe('computeDiff', () => {
    it('should detect added lines', () => {
      const sections = (engine as any).computeDiff('line1', 'line1\nline2');
      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('added');
      expect(sections[0].value).toBe('line2');
    });

    it('should detect removed lines', () => {
      const sections = (engine as any).computeDiff('line1\nline2', 'line1');
      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('removed');
      expect(sections[0].value).toBe('line2');
    });

    it('should detect modified lines', () => {
      const sections = (engine as any).computeDiff('old line', 'new line');
      expect(sections).toHaveLength(1);
      expect(sections[0].type).toBe('modified');
    });
  });

  describe('assessImpact', () => {
    it('should flag system prompt changes as major', () => {
      const impact = (engine as any).assessImpact(
        'You are a helper',
        'You are a senior support agent',
        [{ type: 'modified', value: 'You are a senior support agent', lineStart: 1 }],
      );
      expect(impact).toBe('major');
    });

    it('should return none for no changes', () => {
      const impact = (engine as any).assessImpact('same', 'same', []);
      expect(impact).toBe('none');
    });
  });
});
