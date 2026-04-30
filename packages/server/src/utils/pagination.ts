export function paginateResult<T extends { id: string }>(
  items: T[],
  limit: number,
): { data: T[]; meta: { limit: number; nextCursor?: string } } {
  let nextCursor: string | undefined;
  if (items.length > limit) {
    // biome-ignore lint/style/noNonNullAssertion: safe — guarded by length check
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { data: items, meta: { limit, nextCursor } };
}
