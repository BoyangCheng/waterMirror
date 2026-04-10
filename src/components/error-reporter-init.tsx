"use client";

// 小型客户端组件，专门用来在挂载时启动全局错误上报。
// 放在 (client)/layout.tsx 和 (user)/layout.tsx 里各渲染一次。
// 不渲染任何 UI。

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/client-error-reporter";

export default function ErrorReporterInit() {
  useEffect(() => {
    installClientErrorReporter();
  }, []);
  return null;
}
