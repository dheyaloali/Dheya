import { cookies } from "next/headers";
import { headers } from "next/headers";

export async function getLocale() {
  try {
  // 1. Try to get locale from the pathname (e.g., /en/..., /ar/...)
  const headersList = headers();
  const pathname = headersList.get("x-pathname") || "";
  const match = pathname.match(/^\/([a-zA-Z-]{2,5})\b/);
  if (match) return match[1];

  // 2. Try to get locale from cookies
  const cookiesList = cookies();
  const localeCookie = cookiesList.get("NEXT_LOCALE")?.value;
  if (localeCookie) return localeCookie;

  // 3. Fallback: try Accept-Language header
  const acceptLang = headersList.get("accept-language");
  if (acceptLang) return acceptLang.split(",")[0].split("-")[0];
  } catch (error) {
    console.error("Error getting locale:", error);
  }

  // 4. Default fallback
  return "en";
} 