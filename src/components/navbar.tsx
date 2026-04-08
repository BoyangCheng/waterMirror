"use client";

import Modal from "@/components/dashboard/Modal";
import OrgManagementModal from "@/components/navbar/OrgManagementModal";
import { useAuth, useOrg } from "@/contexts/auth.context";
import { useI18n } from "@/i18n";
import { Building2, ChevronDown, LogOut, User } from "lucide-react";
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

  return (
    <>
      <div className="fixed inset-x-0 top-0 bg-slate-100 z-[10] h-fit py-4">
        <div className="flex items-center justify-between h-full gap-2 px-8 mx-auto">
          <div className="flex flex-row gap-3 justify-center">
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

          <div className="flex items-center gap-2">
            <LanguageSwitcher />

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-slate-200 transition-colors"
              >
                <User size={16} />
                <span className="max-w-[160px] truncate">
                  {user?.emailAddresses[0]?.emailAddress}
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
    </>
  );
}

export default Navbar;
