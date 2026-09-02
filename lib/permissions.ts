import { ROLE_PERMISSIONS } from "@/lib/constants";
import { Permission, ProjectData, SessionUser } from "@/lib/types";

export function hasPermission(user: SessionUser, permission: Permission) {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function canReadProject(user: SessionUser, project: ProjectData) {
  return hasPermission(user, "projects.read:any") || project.ownerId === user.id;
}

export function canWriteProject(user: SessionUser, project: ProjectData) {
  return hasPermission(user, "projects.write:any") || project.ownerId === user.id;
}

export function canReadReport(user: SessionUser, project: ProjectData) {
  return hasPermission(user, "reports.read:any") || project.ownerId === user.id;
}
