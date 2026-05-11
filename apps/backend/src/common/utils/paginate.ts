export async function paginate<T>(
  model: { findMany: (...args: any[]) => Promise<T[]>; count: (...args: any[]) => Promise<number> },
  args: { where?: object; include?: object; select?: object; orderBy?: object },
  pagination: { limit?: number; offset?: number },
) {
  const limit = pagination.limit ?? 20
  const offset = pagination.offset ?? 0

  const [items, total] = await Promise.all([
    model.findMany({ ...args, take: limit, skip: offset }),
    model.count({ where: args.where }),
  ])

  return {
    data: items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  }
}
