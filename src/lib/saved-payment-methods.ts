import type { AuthUser } from "./types";

export function canManageSavedPaymentMethodsUser(user: Pick<AuthUser, "accountType" | "familyRole" | "familyGroupId"> | null | undefined): boolean {
  if (!user) return false;
  const accountType = (user.accountType ?? "PRIVATE").toUpperCase();
  if (accountType === "BUSINESS") return false;
  if (user.familyRole === "MINOR" && user.familyGroupId) return false;
  return true;
}
