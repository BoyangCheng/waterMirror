"use client";

import { useI18n } from "@/i18n";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";
import LanguageSwitcher from "./languageSwitcher";

function Navbar() {
  const { t } = useI18n();

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
          <p className="my-auto text-xl">/</p>
          <div className="my-auto">
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/dashboard"
              hidePersonal={true}
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/dashboard"
              appearance={{
                variables: {
                  fontSize: "0.9rem",
                },
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <UserButton afterSignOutUrl="/sign-in" signInUrl="/sign-in" />
        </div>
      </div>
    </div>
  );
}

export default Navbar;
