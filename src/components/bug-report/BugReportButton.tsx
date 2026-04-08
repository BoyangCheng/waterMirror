"use client";

import Modal from "@/components/dashboard/Modal";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { getRecentConsoleLogs, installConsoleLogger } from "@/lib/console-logger";
import { Bug } from "lucide-react";
import { useState } from "react";

// 模块加载即开始收集 console 日志（最近 200 条），用于 bug 上报
installConsoleLogger();

interface BugReportForm {
  description: string;
  solution: string;
  email: string;
}

const EMPTY_FORM: BugReportForm = { description: "", solution: "", email: "" };

interface BugReportItem {
  id: number;
  createdAt: string;
  email: string | null;
  description: string;
  solution: string;
  pageUrl: string | null;
  userAgent: string | null;
  consoleLogs: { time: string; level: string; message: string }[];
}

export default function BugReportButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BugReportForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<BugReportForm>>({});
  const [submitted, setSubmitted] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminItems, setAdminItems] = useState<BugReportItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const ADMIN_PASSWORD = "1234";

  const loadAdminItems = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch("/api/bug-report");
      const data = await res.json();
      setAdminItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("[BugReport] load list failed:", err);
      setAdminItems([]);
    } finally {
      setAdminLoading(false);
    }
  };

  const requestAdmin = () => {
    setPasswordInput("");
    setPasswordError("");
    setPasswordPromptOpen(true);
  };

  const submitPassword = async () => {
    if (passwordInput !== ADMIN_PASSWORD) {
      setPasswordError("密码错误");
      return;
    }
    setPasswordPromptOpen(false);
    setPasswordInput("");
    setPasswordError("");
    setAdminOpen(true);
    await loadAdminItems();
  };

  const handleChange = (field: keyof BugReportForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<BugReportForm> = {};
    if (!form.description.trim()) {
      newErrors.description = t("bugReport.required");
    }
    if (!form.solution.trim()) {
      newErrors.solution = t("bugReport.required");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          solution: form.solution,
          email: form.email || null,
          consoleLogs: getRecentConsoleLogs(200),
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      });
    } catch (err) {
      console.error("[BugReport] submit failed:", err);
    }
    setSubmitted(true);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setForm(EMPTY_FORM);
      setErrors({});
      setSubmitted(false);
    }, 300);
  };

  return (
    <>
      {/* 左下角浮动按钮 */}
      <button
        type="button"
        title={t("bugReport.title")}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center justify-center w-11 h-11 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
      >
        <Bug size={20} />
      </button>

      {/* 弹窗 */}
      <Modal open={open} onClose={handleClose} closeOnOutsideClick={false}>
        <div className="w-[26rem] px-2">
          <h2 className="text-lg font-semibold mb-4">{t("bugReport.title")}</h2>

          {submitted ? (
            <div className="py-8 text-center">
              <p className="text-green-600 font-medium">{t("bugReport.thankYou")}</p>
              <p className="text-sm text-gray-500 mt-1">{t("bugReport.logged")}</p>
              <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 问题描述（必填） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("bugReport.description")}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-400 ${
                    errors.description ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder={t("bugReport.descriptionPlaceholder")}
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                />
                {errors.description && (
                  <p className="text-xs text-red-500 mt-1">{errors.description}</p>
                )}
              </div>

              {/* 建议解决方案（必填） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("bugReport.solution")}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  rows={3}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-400 ${
                    errors.solution ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder={t("bugReport.solutionPlaceholder")}
                  value={form.solution}
                  onChange={(e) => handleChange("solution", e.target.value)}
                />
                {errors.solution && (
                  <p className="text-xs text-red-500 mt-1">{errors.solution}</p>
                )}
              </div>

              {/* 邮箱（选填） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("bugReport.email")}
                  <span className="text-gray-400 text-xs ml-1">({t("bugReport.optional")})</span>
                </label>
                <input
                  type="email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder={t("bugReport.emailPlaceholder")}
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>

              {/* 提交按钮 */}
              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  {t("common.cancel")}
                </Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSubmit}>
                  {t("bugReport.submit")}
                </Button>
              </div>

              {/* 系统后台入口（低调） */}
              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={requestAdmin}
                  className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
                >
                  系统后台
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 系统后台：bug 列表 */}
      {/* 系统后台：密码验证 */}
      <Modal
        open={passwordPromptOpen}
        onClose={() => setPasswordPromptOpen(false)}
        closeOnOutsideClick={false}
      >
        <div className="w-[22rem] px-2">
          <h2 className="text-base font-semibold mb-3">系统后台</h2>
          <p className="text-xs text-gray-500 mb-2">请输入访问密码</p>
          <input
            type="password"
            autoFocus
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              if (passwordError) setPasswordError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPassword();
            }}
            className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${
              passwordError ? "border-red-400" : "border-gray-300"
            }`}
            placeholder="密码"
          />
          {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasswordPromptOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={submitPassword}>
              确定
            </Button>
          </div>
        </div>
      </Modal>

      {/* 系统后台：bug 列表 */}
      <Modal open={adminOpen} onClose={() => { setAdminOpen(false); setExpandedId(null); }} closeOnOutsideClick={false}>
        <div className="w-[44rem] max-w-[90vw] px-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">系统后台 · Bug 列表</h2>
            <button
              type="button"
              onClick={() => { setAdminOpen(false); setExpandedId(null); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>

          {adminLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">加载中…</div>
          ) : adminItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">暂无 bug 记录</div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-md">
              {adminItems.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <div key={item.id} className="text-sm">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-3"
                    >
                      <span className="text-xs text-gray-400 shrink-0 w-36 tabular-nums">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      <span className="flex-1 truncate text-gray-800">{item.description || "(无描述)"}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {item.consoleLogs.length} logs
                      </span>
                    </button>

                    {expanded && (
                      <div className="px-3 pb-3 bg-gray-50 space-y-2 text-xs text-gray-700">
                        <div>
                          <span className="text-gray-500">邮箱：</span>
                          {item.email || "(未填)"}
                        </div>
                        {item.pageUrl && (
                          <div className="break-all">
                            <span className="text-gray-500">页面：</span>
                            {item.pageUrl}
                          </div>
                        )}
                        {item.userAgent && (
                          <div className="break-all">
                            <span className="text-gray-500">UA：</span>
                            {item.userAgent}
                          </div>
                        )}
                        <div>
                          <div className="text-gray-500 mb-0.5">问题描述：</div>
                          <div className="whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">
                            {item.description}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-0.5">建议方案：</div>
                          <div className="whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">
                            {item.solution}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-0.5">
                            Console 日志（{item.consoleLogs.length}）：
                          </div>
                          {item.consoleLogs.length === 0 ? (
                            <div className="text-gray-400">无</div>
                          ) : (
                            <div className="max-h-64 overflow-auto bg-gray-900 text-gray-100 rounded p-2 font-mono text-[11px] leading-relaxed">
                              {item.consoleLogs.map((log, idx) => {
                                const color =
                                  log.level === "error"
                                    ? "text-red-400"
                                    : log.level === "warn"
                                    ? "text-yellow-300"
                                    : log.level === "info"
                                    ? "text-blue-300"
                                    : "text-gray-100";
                                return (
                                  <div key={idx} className="whitespace-pre-wrap break-all">
                                    <span className="text-gray-500">
                                      {new Date(log.time).toLocaleTimeString()}
                                    </span>{" "}
                                    <span className={color}>[{log.level}]</span> {log.message}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
