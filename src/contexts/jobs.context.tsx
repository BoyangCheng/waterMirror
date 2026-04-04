"use client";

import { useAuth, useOrg } from "@/contexts/auth.context";
import { useJobsQuery, useDeleteJobMutation } from "@/hooks/useJobsQuery";
import type { Job } from "@/types/job";
import React, { useContext, type ReactNode } from "react";

interface JobsContextProps {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  jobsLoading: boolean;
  fetchJobs: () => void;
  deleteJob: (id: string) => Promise<void>;
}

export const JobsContext = React.createContext<JobsContextProps>({
  jobs: [],
  setJobs: () => {},
  jobsLoading: false,
  fetchJobs: () => {},
  deleteJob: async () => {},
});

export function JobsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { organization } = useOrg();

  const {
    data: jobs = [],
    isLoading: jobsLoading,
    refetch,
  } = useJobsQuery(user?.id, organization?.id);

  const deleteMutation = useDeleteJobMutation(user?.id, organization?.id);

  const deleteJob = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <JobsContext.Provider
      value={{
        jobs,
        setJobs: () => {},
        jobsLoading,
        fetchJobs: refetch,
        deleteJob,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export const useJobs = () => useContext(JobsContext);
