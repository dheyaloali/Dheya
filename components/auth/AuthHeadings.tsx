"use client";
import { useTranslations } from "next-intl";

export function AuthHeadings({ type }: { type: "login" | "register" }) {
  const t = useTranslations("Auth");
  if (type === "register") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">{t("createAccount")}</h1>
        <p className="text-sm text-muted-foreground">{t("createAccountDesc")}</p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("loginToAccount")}</h1>
      <p className="text-sm text-muted-foreground">{t("loginToAccountDesc")}</p>
    </>
  );
} 