"use client";

import { useAuth, useOrg } from "@/contexts/auth.context";
import { useInterviewsQuery } from "@/hooks/useInterviewsQuery";
import { getInterviewById as getInterviewByIdService } from "@/services/interviews.service";
import type { Interview } from "@/types/interview";
import React, { useContext, type ReactNode } from "react";

interface InterviewContextProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  getInterviewById: (interviewId: string) => Interview | null | any;
  interviewsLoading: boolean;
  setInterviewsLoading: (interviewsLoading: boolean) => void;
  fetchInterviews: () => void;
}

export const InterviewContext = React.createContext<InterviewContextProps>({
  interviews: [],
  setInterviews: () => {},
  getInterviewById: () => null,
  setInterviewsLoading: () => undefined,
  interviewsLoading: false,
  fetchInterviews: () => {},
});

export function InterviewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { organization } = useOrg();

  const {
    data: interviews = [],
    isLoading: interviewsLoading,
    refetch,
  } = useInterviewsQuery(user?.id, organization?.id);

  const getInterviewById = (interviewId: string) =>
    getInterviewByIdService(interviewId);

  return (
    <InterviewContext.Provider
      value={{
        interviews,
        setInterviews: () => {},
        getInterviewById,
        interviewsLoading,
        setInterviewsLoading: () => {},
        fetchInterviews: refetch,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
}

export const useInterviews = () => useContext(InterviewContext);
