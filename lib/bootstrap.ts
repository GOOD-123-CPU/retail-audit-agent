import { env } from "@/lib/env";
import { Role, UserRecord } from "@/lib/types";
import { createUser, readUsers, writeUsers } from "@/lib/user-store";

type BootstrapAccount = {
  email: string;
  name: string;
  password: string;
  role: Role;
};

function configuredAccounts(): BootstrapAccount[] {
  return [
    {
      email: env.defaultAdminEmail,
      name: env.defaultAdminName,
      password: env.defaultAdminPassword,
      role: "admin"
    },
    {
      email: env.defaultCompanyUserEmail,
      name: env.defaultCompanyUserName,
      password: env.defaultCompanyUserPassword,
      role: "user"
    }
  ];
}

export async function ensureSystemUsers() {
  const existingUsers = await readUsers();
  const usersByEmail = new Map(
    existingUsers.map((user) => [user.email.toLowerCase(), user] satisfies [string, UserRecord])
  );
  const ensuredUsers: UserRecord[] = [...existingUsers];
  let changed = false;

  for (const account of configuredAccounts()) {
    const email = account.email.toLowerCase();
    const existing = usersByEmail.get(email);
    if (existing) {
      if (existing.name !== account.name || existing.role !== account.role) {
        existing.name = account.name;
        existing.role = account.role;
        changed = true;
      }
      continue;
    }

    const created = await createUser(account);
    usersByEmail.set(email, created);
    ensuredUsers.push(created);
  }

  if (changed) {
    await writeUsers(ensuredUsers);
  }

  return ensuredUsers.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function canPublicRegister() {
  const users = await readUsers();
  return users.length === 0 || env.allowPublicRegistration;
}
