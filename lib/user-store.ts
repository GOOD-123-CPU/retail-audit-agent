import crypto from "node:crypto";

import { cleanText } from "@/lib/cleaners";
import {
  readUsersFromDatabase,
  writeUsersToDatabase
} from "@/lib/database-store";
import { ensureDirectories, readJsonFile, usersFile, writeJsonFile } from "@/lib/fs";
import { nowIso } from "@/lib/utils";
import { Role, UserRecord } from "@/lib/types";

function derivePassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = derivePassword(password, salt);
  return { passwordSalt: salt, passwordHash: hash };
}

export async function verifyPassword(password: string, user: UserRecord) {
  const actual = Buffer.from(derivePassword(password, user.passwordSalt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function readUsers() {
  await ensureDirectories();
  const databaseUsers = await readUsersFromDatabase();
  if (databaseUsers) {
    if (databaseUsers.length > 0) {
      return databaseUsers.map((user) => ({
        ...user,
        email: cleanText(user.email, { maxLength: 120, preserveNewlines: false }),
        name: cleanText(user.name, { maxLength: 80 })
      }));
    }

    const fileUsers = await readJsonFile<UserRecord[]>(usersFile, []);
    if (fileUsers.length > 0) {
      await writeUsersToDatabase(fileUsers);
      return fileUsers.map((user) => ({
        ...user,
        email: cleanText(user.email, { maxLength: 120, preserveNewlines: false }),
        name: cleanText(user.name, { maxLength: 80 })
      }));
    }

    return [];
  }

  const fileUsers = await readJsonFile<UserRecord[]>(usersFile, []);
  return fileUsers.map((user) => ({
    ...user,
    email: cleanText(user.email, { maxLength: 120, preserveNewlines: false }),
    name: cleanText(user.name, { maxLength: 80 })
  }));
}

export async function writeUsers(users: UserRecord[]) {
  const wroteToDatabase = await writeUsersToDatabase(users);
  if (!wroteToDatabase) {
    await writeJsonFile(usersFile, users);
    return;
  }

  await writeJsonFile(usersFile, users);
}

export async function createUser(params: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}) {
  const users = await readUsers();
  const existing = users.find((user) => user.email.toLowerCase() === params.email.toLowerCase());
  if (existing) {
    throw new Error("该邮箱已存在。");
  }

  const role = params.role ?? (users.length === 0 ? "admin" : "user");
  const timestamp = nowIso();
  const passwordState = await hashPassword(params.password);

  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: params.email.toLowerCase(),
    name: params.name,
    role,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...passwordState
  };

  users.push(user);
  await writeUsers(users);
  return user;
}

export async function updateUserRole(userId: string, role: Role) {
  const users = await readUsers();
  const current = users.find((user) => user.id === userId);

  if (!current) {
    throw new Error("用户不存在。");
  }

  if (current.role === "admin" && role !== "admin") {
    const adminCount = users.filter((user) => user.role === "admin").length;
    if (adminCount <= 1) {
      throw new Error("系统至少保留一名管理员。");
    }
  }

  current.role = role;
  current.updatedAt = nowIso();
  await writeUsers(users);
  return current;
}

export async function deleteUser(userId: string) {
  const users = await readUsers();
  const current = users.find((user) => user.id === userId);

  if (!current) {
    throw new Error("用户不存在。");
  }

  if (current.role === "admin" && users.filter((user) => user.role === "admin").length <= 1) {
    throw new Error("系统至少保留一名管理员，无法删除。");
  }

  const nextUsers = users.filter((user) => user.id !== userId);
  await writeUsers(nextUsers);
}

export async function authenticateUser(email: string, password: string) {
  const users = await readUsers();
  const user = users.find((candidate) => candidate.email === email.toLowerCase());

  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user);
  if (!valid) {
    return null;
  }

  user.lastLoginAt = nowIso();
  user.updatedAt = nowIso();
  await writeUsers(users);

  return user;
}
