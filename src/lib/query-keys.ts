/**
 * Centralized React Query key factory.
 * Using const tuples ensures type-safe invalidation and cache access.
 */
export const queryKeys = {
  interviews: {
    all: (userId: string, orgId: string) =>
      ["interviews", userId, orgId] as const,
    detail: (id: string) => ["interview", id] as const,
  },
  interviewers: {
    all: (userId: string) => ["interviewers", userId] as const,
  },
  jobs: {
    all: (userId: string, orgId: string) =>
      ["jobs", userId, orgId] as const,
  },
  organization: {
    detail: (orgId: string) => ["organization", orgId] as const,
    responseCount: (orgId: string) => ["responseCount", orgId] as const,
    ensureClient: (userId: string) => ["ensure-client", userId] as const,
    ensureOrg: (orgId: string) => ["ensure-org", orgId] as const,
  },
} as const;
