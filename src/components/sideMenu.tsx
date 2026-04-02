"use client";

import { useI18n } from "@/i18n";
import { FileSearch, PlayCircleIcon, SpeechIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";

function SideMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="z-[10] bg-slate-100 p-6 w-[200px] fixed top-[64px] left-0 h-full">
      <div className="flex flex-col gap-1">
        <div className="flex flex-col justify-between gap-2">
          <button
            type="button"
            className={`flex flex-row p-3 rounded-md hover:bg-slate-200 cursor-pointer ${
              pathname.endsWith("/dashboard") || pathname.includes("/interviews")
                ? "bg-indigo-200"
                : "bg-slate-100"
            }`}
            onClick={() => router.push("/dashboard")}
          >
            <PlayCircleIcon className="font-thin	 mr-2" />
            <p className="font-medium ">{t("nav.interviews")}</p>
          </button>
          <button
            type="button"
            className={`flex flex-row p-3 rounded-md hover:bg-slate-200 cursor-pointer ${
              pathname.endsWith("/interviewers") ? "bg-indigo-200" : "bg-slate-100"
            }`}
            onClick={() => router.push("/dashboard/interviewers")}
          >
            <SpeechIcon className="font-thin mr-2" />
            <p className="font-medium ">{t("nav.interviewers")}</p>
          </button>
          <button
            type="button"
            className={`flex flex-row p-3 rounded-md hover:bg-slate-200 cursor-pointer ${
              pathname.includes("/screening") ? "bg-indigo-200" : "bg-slate-100"
            }`}
            onClick={() => router.push("/dashboard/screening")}
          >
            <FileSearch className="font-thin mr-2" />
            <p className="font-medium ">{t("nav.screening")}</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SideMenu;
