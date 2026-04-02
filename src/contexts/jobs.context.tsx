"use client";

import { useAuth, useOrg } from "@/contexts/auth.context";
import { getAllJobs } from "@/services/jobs.service";
import type { Job } from "@/types/job";
import React, { useState, useContext, type ReactNode, useEffect, useCallback } from "react";

interface JobsContextProps {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  jobsLoading: boolean;
  fetchJobs: () => void;
}

export const JobsContext = React.createContext<JobsContextProps>({
  jobs: [],
  setJobs: () => {},
  jobsLoading: false,
  fetchJobs: () => {},
});

interface JobsProviderProps {
  children: ReactNode;
}

export function JobsProvider({ children }: JobsProviderProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const { user } = useAuth();
  const { organization } = useOrg();
  const [jobsLoading, setJobsLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      const response = await getAllJobs(
        user?.id as string,
        organization?.id as string,
      );
      setJobs(response as Job[]);
    } catch (error) {
      console.error(error);
    }
    setJobsLoading(false);
  }, [user?.id, organization?.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (organization?.id || user?.id) {
      fetchJobs();
    }
  }, [organization?.id, user?.id]);

  return (
    <JobsContext.Provider
      value={{
        jobs,
        setJobs,
        jobsLoading,
        fetchJobs,
      }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export const useJobs = () => {
  const value = useContext(JobsContext);
  return value;
};
