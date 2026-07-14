import { z } from "zod";
import { ACTION_PRIORITIES, ACTION_STATUSES } from "@/lib/types";

export const ActionCreateSchema = z.object({
  derivedFromClaimId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(1000).nullable().optional(),
  priority: z.enum(ACTION_PRIORITIES).default("medium"),
  dueAt: z.string().datetime().nullable().optional(),
});

export const ActionPatchSchema = z
  .object({
    status: z.enum(ACTION_STATUSES).optional(),
    priority: z.enum(ACTION_PRIORITIES).optional(),
    title: z.string().trim().min(1).max(220).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .strict();
