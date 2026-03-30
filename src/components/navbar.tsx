"use client";

import { useAuth, useOrg } from "@/contexts/auth.context";
import { useI18n } from "@/i18n";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import React from "react";
import LanguageSwitcher from "./languageSwitcher";

function Navbar() {
  const { t } = useI18n();
  const { organization } = useOrg();
  const { user, signOut } = useAuth();

  return (
    <div className="fixed inset-x-0 top-0 bg-slate-100  z-[10] h-fit  py-4 ">
      <div className="flex items-center justify-between h-full gap-2 px-8 mx-auto">
        <div className="flex flex-row gap-3 justify-center">
          <Link href={"/dashboard"} className="flex items-center gap-2">
            <p className="px-2 py-1 text-2xl font-bold text-black">
              Folo<span className="text-indigo-600">Up</span>{" "}
              <span className="text-[8px]">{t("common.beta")}</span>
            </p>
          </Link>
          {organization && (
            <>
              <p className="my-auto text-xl">/</p>
              <span className="my-auto text-sm font-medium text-gray-700">
                {organization.name}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <div className="flex items-center gap-2">
            {user && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <User size={16} />
                {user.emailAddresses[0]?.emailAddress}
              </span>
            )}
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
