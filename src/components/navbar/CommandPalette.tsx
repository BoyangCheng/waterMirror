"use client";

// 全局搜索（Command Palette）
// - 通过 ⌘K / Ctrl+K 或 navbar 中间的搜索框触发
// - 数据全部来自前端 context（useInterviews + useJobs），不打后端
// - 使用 cmdk 库实现 fuzzy 搜索 + 键盘导航
//
// V1 范围：搜索面试 + 职位
// V2 待加：候选人搜索（需要新增 useInterviewees context 或后端 search API）

import { useInterviews } from "@/contexts/interviews.context";
import { useJobs } from "@/contexts/jobs.context";
import { useI18n } from "@/i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Briefcase, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { interviews } = useInterviews();
  const { jobs } = useJobs();
  const [q, setQ] = useState("");

  // 关闭时清空 query，下次打开是干净状态
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const onSelect = (path: string) => {
    onOpenChange(false);
    router.push(path);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed top-[18%] left-1/2 -translate-x-1/2 w-[92%] max-w-xl z-[101] outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{t("nav.commandTitle")}</Dialog.Title>
          <Command
            label="Command palette"
            className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          >
            <div className="flex items-center px-4 border-b border-gray-100">
              <Search size={18} className="text-gray-400 mr-3 flex-none" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder={t("nav.commandPlaceholder")}
                className="w-full py-4 text-base outline-none bg-transparent placeholder:text-gray-400"
                autoFocus
              />
              <kbd className="ml-3 hidden sm:inline text-[11px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 font-mono">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-gray-400">
                {t("nav.commandEmpty")}
              </Command.Empty>

              {interviews.length > 0 && (
                <Command.Group heading={t("nav.commandInterviews")}>
                  {interviews.map((iv) => (
                    <Command.Item
                      key={iv.id}
                      value={`interview ${iv.name ?? ""} ${iv.id}`}
                      onSelect={() => onSelect(`/interviews/${iv.id}`)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-900 transition-colors"
                    >
                      <MessageSquare size={16} className="text-indigo-500 flex-none" />
                      <span className="text-sm font-medium truncate">{iv.name}</span>
                      {iv.response_count && Number(iv.response_count) > 0 && (
                        <span className="ml-auto text-xs text-gray-400 flex-none">
                          {String(iv.response_count)} {t("nav.commandPeopleSuffix")}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {jobs.length > 0 && (
                <Command.Group heading={t("nav.commandJobs")}>
                  {jobs.map((j) => (
                    <Command.Item
                      key={j.id}
                      value={`job ${j.name} ${j.id}`}
                      onSelect={() => onSelect(`/dashboard/screening/${j.id}`)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-900 transition-colors"
                    >
                      <Briefcase size={16} className="text-purple-500 flex-none" />
                      <span className="text-sm font-medium truncate">{j.name}</span>
                      <span className="ml-auto text-xs text-gray-400 flex-none">
                        {j.status === "completed" ? t("nav.jobCompleted") : t("nav.jobProcessing")}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50 text-[11px] text-gray-400">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 font-mono">↑↓</kbd>
                  {t("nav.commandNavigate")}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 font-mono">↵</kbd>
                  {t("nav.commandSelect")}
                </span>
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
