"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function AuthNavLink({ type }: { type: "login" | "register" }) {
  const t = useTranslations("Auth");
  if (type === "register") {
    return (
      <p className="px-8 text-center text-sm text-muted-foreground">
        {t("alreadyHaveAccount")} {" "}
        <Link href="/login" className="underline underline-offset-4 hover:text-primary">
          {t("login")}
        </Link>
      </p>
    );
  }
  return (
    <p className="mt-2 text-center text-sm text-muted-foreground">
      {t("dontHaveAccount")} {" "}
      <Link href="/register" className="text-primary underline underline-offset-4 hover:text-primary/90">
        {t("register")}
      </Link>
    </p>
  );
} 