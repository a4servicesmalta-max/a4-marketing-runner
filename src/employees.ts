import { MARKETING_TEAM, type MarketingEmployee } from "./team.js";

export function listEmployees(): MarketingEmployee[] {
  return MARKETING_TEAM;
}
export function getEmployee(id: string): MarketingEmployee | undefined {
  return MARKETING_TEAM.find((e) => e.id === id);
}
