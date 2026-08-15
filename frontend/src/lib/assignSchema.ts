import { z } from 'zod'

export function createAssignSchema(branchRequired = 'Branch is required') {
  return z.object({
    employee_id: z
      .union([z.string().min(1), z.literal('').transform(() => undefined)])
      .optional(),
    department_id: z
      .union([z.string().min(1), z.literal('').transform(() => undefined)])
      .optional(),
    branch_id: z.string().min(1, branchRequired),
    notes: z.string().optional(),
  })
}

export const assignSchema = createAssignSchema()

export type AssignFormData = z.infer<typeof assignSchema>
