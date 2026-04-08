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

// IMPORTANT: compose() must be called once at module scope, not inside the
// render function. If it is called inside the component body, a brand-new
// component type is produced on every render, which causes React to unmount
// and remount the entire provider subtree (and everything below it). This
// would wipe out state in children like the Call component, leaving the RTC
// engine orphaned while the UI snaps back to its initial state.
const ComposedProviders = compose([
  InterviewProvider,
  InterviewerProvider,
  ResponseProvider,
  ClientProvider,
  JobsProvider,
]);

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

  return (
    <I18nProvider>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <QueryClientProvider client={queryClient}>
          <ComposedProviders>{children}</ComposedProviders>
        </QueryClientProvider>
      </NextThemesProvider>
    </I18nProvider>
  );
};

export default providers;
