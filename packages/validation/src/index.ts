import { z } from "zod";

export const fieldTypes = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "EMAIL",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE"
] as const;

export const fieldDefinitionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(fieldTypes),
  label: z.string().trim().min(1).max(160),
  helpText: z.string().trim().max(500).nullable().optional(),
  required: z.boolean().default(false),
  position: z.number().int().min(0),
  options: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  validation: z.object({ minLength: z.number().int().min(0).optional(), maxLength: z.number().int().min(1).max(10000).optional() }).optional()
}).superRefine((field, context) => {
  if (field.type === "SINGLE_CHOICE" || field.type === "MULTIPLE_CHOICE") {
    const options = field.options ?? [];
    if (options.length < 2) context.addIssue({ code: "custom", path: ["options"], message: "Choice questions need at least two options." });
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) context.addIssue({ code: "custom", path: ["options"], message: "Choice options must be unique." });
  }
});

export const formDefinitionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  limitOneResponsePerEmail: z.boolean().default(false),
  fields: z.array(fieldDefinitionSchema).max(50)
});

export const submissionSchema = z.object({
  answers: z.array(z.object({ fieldId: z.string().min(1), value: z.unknown() })).max(50),
  respondent: z.object({ name: z.string().trim().max(160).optional(), email: z.string().trim().email().max(320).optional() }).optional(),
  website: z.string().max(500).optional()
});

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type FormDefinition = z.infer<typeof formDefinitionSchema>;
export type SubmissionInput = z.infer<typeof submissionSchema>;
