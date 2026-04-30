import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../template.js';

describe('renderTemplate', () => {
  it('should render simple variable substitution', () => {
    const result = renderTemplate('Hello {{name}}', { name: 'World' });
    expect(result.rendered).toBe('Hello World');
    expect(result.variablesUsed).toContain('name');
    expect(result.missingVariables).toHaveLength(0);
  });

  it('should detect missing variables', () => {
    const result = renderTemplate('Hello {{name}}, your order is {{orderId}}', {});
    expect(result.missingVariables).toContain('name');
    expect(result.missingVariables).toContain('orderId');
  });

  it('should handle multiple variables', () => {
    const result = renderTemplate('{{greeting}} {{name}}', {
      greeting: 'Hi',
      name: 'Alice',
    });
    expect(result.rendered).toBe('Hi Alice');
    expect(result.variablesUsed).toHaveLength(2);
  });

  it('should handle empty template', () => {
    const result = renderTemplate('');
    expect(result.rendered).toBe('');
    expect(result.variablesUsed).toHaveLength(0);
  });

  it('should handle template with no variables', () => {
    const result = renderTemplate('Hello world');
    expect(result.rendered).toBe('Hello world');
    expect(result.variablesUsed).toHaveLength(0);
  });
});
