import type { LabStatus } from "@/generated/prisma/enums";

export const labTransitions: Record<LabStatus, LabStatus[]> = {
  ORDERED: ["SAMPLE_PENDING", "CANCELLED"],
  SAMPLE_PENDING: ["SAMPLE_COLLECTED", "CANCELLED"],
  SAMPLE_COLLECTED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["VERIFIED"],
  VERIFIED: ["RELEASED"],
  RELEASED: [],
  CANCELLED: [],
};
