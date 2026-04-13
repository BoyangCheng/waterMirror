"use client";

import { useOrg } from "@/contexts/auth.context";
import {
  useInterviewersQuery,
  useCreateInterviewerMutation,
  useDeleteInterviewerMutation,
} from "@/hooks/useInterviewersQuery";
import type { Interviewer } from "@/types/interviewer";
import React, { useContext, type ReactNode } from "react";

interface InterviewerContextProps {
  interviewers: Interviewer[];
  setInterviewers: React.Dispatch<React.SetStateAction<Interviewer[]>>;
  createInterviewer: (payload: any) => Promise<void>;
  deleteInterviewer: (id: bigint) => Promise<void>;
  fetchInterviewers: () => void;
  interviewersLoading: boolean;
  setInterviewersLoading: (interviewersLoading: boolean) => void;
}

export const InterviewerContext = React.createContext<InterviewerContextProps>({
  interviewers: [],
  setInterviewers: () => {},
  createInterviewer: async () => {},
  deleteInterviewer: async () => {},
  fetchInterviewers: () => {},
  interviewersLoading: false,
  setInterviewersLoading: () => undefined,
});

export function InterviewerProvider({ children }: { children: ReactNode }) {
  const { organization } = useOrg();

  const {
    data: interviewers = [],
    isLoading: interviewersLoading,
    refetch,
  } = useInterviewersQuery(organization?.id);

  const createMutation = useCreateInterviewerMutation(organization?.id);
  const deleteMutation = useDeleteInterviewerMutation(organization?.id);

  const createInterviewer = async (payload: any) => {
    await createMutation.mutateAsync({ ...payload, organization_id: organization?.id });
  };

  const deleteInterviewer = async (id: bigint) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <InterviewerContext.Provider
      value={{
        interviewers,
        setInterviewers: () => {},
        createInterviewer,
        deleteInterviewer,
        fetchInterviewers: refetch,
        interviewersLoading,
        setInterviewersLoading: () => {},
      }}
    >
      {children}
    </InterviewerContext.Provider>
  );
}

export const useInterviewers = () => useContext(InterviewerContext);
