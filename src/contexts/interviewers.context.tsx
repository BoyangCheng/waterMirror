import { useAuth } from "@/contexts/auth.context";
import { getAllInterviewers, createInterviewer as createInterviewerService, deleteInterviewer as deleteInterviewerService } from "@/services/interviewers.service";
import type { Interviewer } from "@/types/interviewer";
import React, { useState, useContext, type ReactNode, useEffect } from "react";

interface InterviewerContextProps {
  interviewers: Interviewer[];
  setInterviewers: React.Dispatch<React.SetStateAction<Interviewer[]>>;
  createInterviewer: (payload: any) => void;
  deleteInterviewer: (id: bigint) => Promise<void>;
  fetchInterviewers: () => Promise<void>;
  interviewersLoading: boolean;
  setInterviewersLoading: (interviewersLoading: boolean) => void;
}

export const InterviewerContext = React.createContext<InterviewerContextProps>({
  interviewers: [],
  setInterviewers: () => {},
  createInterviewer: () => {},
  deleteInterviewer: async () => {},
  fetchInterviewers: async () => {},
  interviewersLoading: false,
  setInterviewersLoading: () => undefined,
});

interface InterviewerProviderProps {
  children: ReactNode;
}

export function InterviewerProvider({ children }: InterviewerProviderProps) {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const { user } = useAuth();
  const [interviewersLoading, setInterviewersLoading] = useState(true);

  const fetchInterviewers = async () => {
    try {
      setInterviewersLoading(true);
      const response = await getAllInterviewers(user?.id as string);
      setInterviewers(response as any);
    } catch (error) {
      console.error(error);
    }
    setInterviewersLoading(false);
  };

  const createInterviewer = async (payload: any) => {
    await createInterviewerService({ ...payload });
    fetchInterviewers();
  };

  const deleteInterviewer = async (id: bigint) => {
    await deleteInterviewerService(id);
    setInterviewers((prev) => prev.filter((i) => i.id !== id));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (user?.id) {
      fetchInterviewers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <InterviewerContext.Provider
      value={{
        interviewers,
        setInterviewers,
        createInterviewer,
        deleteInterviewer,
        fetchInterviewers,
        interviewersLoading,
        setInterviewersLoading,
      }}
    >
      {children}
    </InterviewerContext.Provider>
  );
}

export const useInterviewers = () => {
  const value = useContext(InterviewerContext);

  return value;
};
