import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  // 仅允许相对路径（必须以单个 `/` 开头），否则忽略。
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : null;
  const target = safeNext
    ? `/api/auth/login?next=${encodeURIComponent(safeNext)}`
    : "/api/auth/login";
  redirect(target);
}
