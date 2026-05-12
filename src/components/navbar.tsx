"use client";

import Modal from "@/components/dashboard/Modal";
import { CommandPalette } from "@/components/navbar/CommandPalette";
import { NotificationBell } from "@/components/navbar/NotificationBell";
import OrgManagementModal from "@/components/navbar/OrgManagementModal";
import { useAuth, useOrg } from "@/contexts/auth.context";
import { useI18n } from "@/i18n";
import { Building2, ChevronDown, LogOut, Search, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import LanguageSwitcher from "./languageSwitcher";

const AUTHING_APP_HOST = process.env.NEXT_PUBLIC_AUTHING_APP_HOST ?? "";

function Navbar() {
  const { t } = useI18n();
  const { organization } = useOrg();
  const { user, signOut } = useAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ⌘K (Mac) / Ctrl+K (Win/Linux) 全局打开搜索面板
  // 客户端 mount 后才能读 navigator.platform，避免 hydration mismatch
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* z-[20] 比 sideMenu 的 z-[10] 高，navbar 的下沿阴影压在侧边栏顶部上方
          视觉上"横线在竖线之上"，两条阴影不打架 */}
      <div className="fixed inset-x-0 top-0 bg-slate-100 z-[20] h-fit py-4 shadow-md">
        <div className="flex items-center justify-between h-full gap-2 px-8 mx-auto">
          <div className="flex flex-row gap-3 justify-center flex-none">
            <Link href={"/dashboard"} className="flex items-center gap-2 flex-none">
              <img
                src="/watermirrorlogo.png"
                alt="WaterMirror"
                className="h-12 w-auto flex-none"
                style={{ background: "transparent" }}
              />
            </Link>
            {organization && (
              <span className="my-auto text-sm font-medium text-gray-700">{organization.name}</span>
            )}
          </div>

          {/* 全局搜索 trigger —— 中央显示一个看起来像 input 的 button，
              点击 / ⌘K 弹出 CommandPalette */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2.5 mx-6 flex-1 max-w-md px-3 py-2 rounded-lg border border-gray-200 bg-white/70 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all text-sm text-gray-400"
          >
            <Search size={15} className="flex-none" />
            <span className="flex-1 text-left truncate">{t("nav.searchTrigger")}</span>
            <kbd className="text-[11px] bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-500 flex-none">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>

          <div className="flex items-center gap-2 flex-none">
            <NotificationBell />
            <LanguageSwitcher />

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-slate-200 transition-colors"
              >
                <User size={16} />
                <span className="max-w-[160px] truncate">
                  {user?.phone || user?.emailAddresses?.[0]?.emailAddress || user?.name || user?.id}
                </span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-50">
                  <a
                    href={`${AUTHING_APP_HOST}/u`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={15} />
                    {t("userMenu.userManagement")}
                  </a>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      setDropdownOpen(false);
                      setShowOrgModal(true);
                    }}
                  >
                    <Building2 size={15} />
                    {t("userMenu.orgManagement")}
                  </button>
                  <hr className="my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    {t("userMenu.signOut")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={showOrgModal} closeOnOutsideClick={true} onClose={() => setShowOrgModal(false)}>
        <OrgManagementModal onClose={() => setShowOrgModal(false)} />
      </Modal>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

export default Navbar;
