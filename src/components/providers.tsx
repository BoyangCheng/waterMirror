"use client";

import { ClientProvider } from "@/contexts/clients.context";
import { InterviewerProvider } from "@/contexts/interviewers.context";
import { InterviewProvider } from "@/contexts/interviews.context";
import { JobsProvider } from "@/contexts/jobs.context";
import { ResponseProvider } from "@/contexts/responses.context";
import { I18nProvider } from "@/i18n";
import compose from "@/lib/compose";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";
import React, { useState } from "react";

const providers = ({ children }: ThemeProviderProps) => {
  // 用 useState 初始化，确保每个客户端会话独立的缓存实例
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,        // 默认 1min 内不重新请求
            gcTime: 5 * 60 * 1000,       // 5min 后清除未使用的缓存
            retry: 1,                     // 失败只重试一次
            refetchOnWindowFocus: false,  // 切换窗口不自动重新请求
          },
        },
      }),
  );

  const Provider = compose([
    InterviewProvider,
    InterviewerProvider,
    ResponseProvider,
    ClientProvider,
    JobsProvider,
  ]);

  return (
    <I18nProvider>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <QueryClientProvider client={queryClient}>
          <Provider>{children}</Provider>
        </QueryClientProvider>
      </NextThemesProvider>
    </I18nProvider>
  );
};

export default providers;
