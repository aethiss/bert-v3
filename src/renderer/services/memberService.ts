export interface MemberSearchParams {
  query: string;
}

export async function searchMembers(params: MemberSearchParams): Promise<string[]> {
  if (!params.query.trim()) {
    return [];
  }

  return [];
}
