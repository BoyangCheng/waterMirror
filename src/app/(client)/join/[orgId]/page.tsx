"use client";

import { joinOrganization } from "@/services/clients.service";
import { useAuth } from "@/contexts/auth.context";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JoinOrgPage() {
  const { user, isLoaded } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [status, setStatus] = useState<"loading" | "success" | "error" | "waiting">("waiting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      // 把 invite 路径带进 sign-in → login → Authing 的 state，
      // callback 里可以直接识别是邀请登录并闭环处理。
      const next = encodeURIComponent(`/join/${orgId}`);
      router.replace(`/sign-in?next=${next}`);
      return;
    }

    const join = async () => {
      setStatus("loading");
      const result = await joinOrganization(user.id, orgId);
      if (result.success) {
        setStatus("success");
        // Refresh JWT so new org_id takes effect, then go to dashboard
        router.replace(`/api/auth/refresh?redirectTo=/dashboard`);
      } else {
        setStatus("error");
        setMessage(result.error ?? "加入组织失败");
      }
    };

    join();
  }, [isLoaded, user, orgId, router]);

  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="text-center">
        {status === "waiting" || status === "loading" ? (
          <p className="text-gray-600">正在加入组织...</p>
        ) : status === "success" ? (
          <p className="text-green-600">加入成功，正在跳转...</p>
        ) : (
          <div>
            <p className="text-red-600 font-medium">加入失败</p>
            <p className="text-gray-500 text-sm mt-1">{message}</p>
            <button
              type="button"
              onClick={() => router.replace("/dashboard")}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold"
            >
              返回主页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
