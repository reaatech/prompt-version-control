import { prisma } from '../db/client.js';
import { NotFoundError } from '../errors.js';
import type { DiffResult, DiffSection } from '@pvc/shared';

export class DiffEngine {
  async diff(
    projectId: string,
    promptId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<DiffResult> {
    const [from, to] = await Promise.all([
      prisma.version.findFirst({
        where: { promptId, number: fromVersion, prompt: { projectId } },
      }),
      prisma.version.findFirst({
        where: { promptId, number: toVersion, prompt: { projectId } },
      }),
    ]);

    if (!from) {
      throw new NotFoundError('Version', String(fromVersion));
    }
    if (!to) {
      throw new NotFoundError('Version', String(toVersion));
    }

    const sections = this.computeDiff(from.content, to.content);
    const semanticImpact = this.assessImpact(from.content, to.content, sections);

    return {
      fromVersion: from.number,
      toVersion: to.number,
      sections,
      semanticImpact,
    };
  }

  /**
   * Simplified line-wise diff for prompt text. Heuristic-based (not a full
   * Myers/LCS), optimized for readability of prompt changes. For production
   * use with fine-grained diffs, consider integrating a dedicated diff library.
   */
  private computeDiff(from: string, to: string): DiffSection[] {
    const sections: DiffSection[] = [];
    const fromLines = from.split('\n');
    const toLines = to.split('\n');

    let i = 0;
    let j = 0;

    while (i < fromLines.length || j < toLines.length) {
      if (i >= fromLines.length) {
        sections.push({ type: 'added', value: toLines[j]! });
        j++;
      } else if (j >= toLines.length) {
        sections.push({ type: 'removed', value: fromLines[i]! });
        i++;
      } else if (fromLines[i] === toLines[j]) {
        i++;
        j++;
      } else {
        const nextMatchFrom = toLines.indexOf(fromLines[i]!, j);
        const nextMatchTo = fromLines.indexOf(toLines[j]!, i);

        if (nextMatchFrom === -1 && nextMatchTo === -1) {
          sections.push({ type: 'modified', value: toLines[j]!, lineStart: i + 1 });
          i++;
          j++;
        } else if (nextMatchTo !== -1 && (nextMatchFrom === -1 || nextMatchTo < nextMatchFrom)) {
          for (let k = i; k < nextMatchTo; k++) {
            sections.push({ type: 'removed', value: fromLines[k]! });
          }
          i = nextMatchTo;
        } else {
          for (let k = j; k < nextMatchFrom; k++) {
            sections.push({ type: 'added', value: toLines[k]! });
          }
          j = nextMatchFrom;
        }
      }
    }

    return sections;
  }

  private assessImpact(
    from: string,
    to: string,
    sections: DiffSection[],
  ): 'none' | 'minor' | 'major' {
    if (sections.length === 0) return 'none';

    const addedLines = sections.filter((s) => s.type === 'added').length;
    const removedLines = sections.filter((s) => s.type === 'removed').length;
    const totalLines = Math.max(from.split('\n').length, to.split('\n').length);

    const changeRatio = (addedLines + removedLines) / totalLines;

    const hasSystemChange = sections.some(
      (s) =>
        s.lineStart !== undefined &&
        s.lineStart <= 3 &&
        /system|you are|role|persona/i.test(s.value),
    );

    if (hasSystemChange || changeRatio > 0.5) return 'major';
    if (changeRatio > 0.1) return 'minor';
    return 'none';
  }
}

export const diffEngine = new DiffEngine();
