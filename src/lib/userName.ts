export type UserNameFields = {
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  email?: string | null;
};

export function formatUserLegalName(user: UserNameFields): string {
  return [user.firstName, user.lastName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function formatUserGreetingName(user: UserNameFields): string {
  const nick = (user.nickname ?? "").trim();
  if (nick) return nick;
  const legal = formatUserLegalName(user);
  if (legal) return legal;
  const email = (user.email ?? "").trim();
  if (email.includes("@")) return email.split("@")[0] ?? email;
  return email || "";
}
