"use client";

import { useI18n } from "@/i18n";
import { FileSearch, PlayCircleIcon, SpeechIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

function SideMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  // 整体放大：宽度 200 → 240，padding 6 → 8；菜单项 padding 3→4，间距 2→3
  // shadow-[Xpx_Ypx_blur_spread_color]：x=2px 阴影只往右偏，y=0 不上下漂，blur=8px 柔和，
  //   和顶部 navbar 的 shadow-md 视觉量级一致，把整个内容区像"画框"一样勾出来
  return (
    <div className="z-[10] bg-slate-100 p-8 w-[240px] fixed top-[64px] left-0 h-full shadow-[2px_0_8px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col justify-between gap-3">
          {/* 顺序按需求：简历筛排 → 面试 → 面试官；
              /dashboard 默认路由（点 logo 等其它入口落点）仍是「面试」，没动
              hover 时整条菜单项放大 5%（origin-left 让左对齐文字不会跳）+ 背景变深 */}
          <button
            type="button"
            className={`flex flex-row items-center p-4 rounded-md cursor-pointer transition-all duration-200 origin-left hover:scale-105 hover:bg-slate-200 ${
              pathname.includes("/screening") ? "bg-indigo-200" : "bg-slate-100"
            }`}
            onClick={() => router.push("/dashboard/screening")}
          >
            <FileSearch className="mr-3" size={22} strokeWidth={2.5} />
            <p className="font-bold text-base">{t("nav.screening")}</p>
          </button>
          <button
            type="button"
            className={`flex flex-row items-center p-4 rounded-md cursor-pointer transition-all duration-200 origin-left hover:scale-105 hover:bg-slate-200 ${
              pathname.endsWith("/dashboard") || pathname.includes("/interviews")
                ? "bg-indigo-200"
                : "bg-slate-100"
            }`}
            onClick={() => router.push("/dashboard")}
          >
            <PlayCircleIcon className="mr-3" size={22} strokeWidth={2.5} />
            <p className="font-bold text-base">{t("nav.interviews")}</p>
          </button>
          <button
            type="button"
            className={`flex flex-row items-center p-4 rounded-md cursor-pointer transition-all duration-200 origin-left hover:scale-105 hover:bg-slate-200 ${
              pathname.endsWith("/interviewers") ? "bg-indigo-200" : "bg-slate-100"
            }`}
            onClick={() => router.push("/dashboard/interviewers")}
          >
            <SpeechIcon className="mr-3" size={22} strokeWidth={2.5} />
            <p className="font-bold text-base">{t("nav.interviewers")}</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SideMenu;
