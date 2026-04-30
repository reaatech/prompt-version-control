import Handlebars from 'handlebars';

export interface RenderTemplateResult {
  rendered: string;
  variablesUsed: string[];
  missingVariables: string[];
}

export function renderTemplate(
  template: string,
  variables: Record<string, unknown> = {},
): RenderTemplateResult {
  // noEscape: prompt templates are plain text, not HTML — variable values
  // should be rendered verbatim (including angle brackets, ampersands, etc.).
  const compiled = Handlebars.compile(template, { noEscape: true });
  const rendered = compiled(variables);

  // Simple regex-based variable extraction
  const regex = /\{\{\{?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}?\}\}/g;
  const variablesUsed = new Set<string>();
  let match: RegExpExecArray | null;
  do {
    match = regex.exec(template);
    if (match) {
      variablesUsed.add(match[1]);
    }
  } while (match !== null);

  const missingVariables: string[] = [];
  for (const v of variablesUsed) {
    if (variables[v] === undefined) {
      missingVariables.push(v);
    }
  }

  return {
    rendered,
    variablesUsed: Array.from(variablesUsed),
    missingVariables,
  };
}
