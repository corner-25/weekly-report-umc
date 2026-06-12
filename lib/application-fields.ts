// Shared helpers for SecretaryApplication: validation + auto-advance rule.
// Centralizing here keeps POST/PUT routes in lock-step with whatever the
// recruitment workflow decides next.

import { z } from 'zod';
import type { ApplicationStatus, ScreeningRating, ScreeningResult } from '@prisma/client';

const ratingValues = ['EXCELLENT', 'GOOD', 'FAIR', 'AVERAGE', 'POOR'] as const;
const resultValues = ['PASS', 'FAIL'] as const;
const statusValues = ['SCREENING', 'INTERVIEW', 'ACCEPTED', 'REJECTED'] as const;

const ratingSchema = z.enum(ratingValues).optional().nullable();
const resultSchema = z.enum(resultValues).optional().nullable();
const statusSchema = z.enum(statusValues).optional();

// Shared shape — used by both create (POST) and update (PUT).
export const applicationFieldsSchema = z.object({
  fullName: z.string().min(1, 'Họ và tên không được để trống').optional(),
  dateOfBirth: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
  temporaryAddress: z.string().optional().nullable(),
  cvUrl: z.string().optional().nullable(),

  // Học vấn
  education: z.string().optional().nullable(),
  educationInstitution: z.string().optional().nullable(),
  graduationYear: z.number().int().optional().nullable(),
  graduationRank: z.string().optional().nullable(),
  trainingCertificate: z.string().optional().nullable(),
  foreignLanguage: z.string().optional().nullable(),
  itSkill: z.string().optional().nullable(),

  // Kinh nghiệm
  appliedPosition: z.string().optional().nullable(),
  workExperience: z.string().optional().nullable(),
  previousSalary: z.union([z.number(), z.string()]).optional().nullable(),
  resignReason: z.string().optional().nullable(),

  // Bệnh viện
  knowsHospital: z.boolean().optional().nullable(),
  hospitalRelative: z.string().optional().nullable(),

  // Định tuyến
  appliedTypeId: z.string().optional().nullable(),
  desiredDepartmentId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: statusSchema,

  // Sơ tuyển
  screeningDate: z.string().optional().nullable(),
  screeningLocation: z.string().optional().nullable(),
  screeningPanel: z.string().optional().nullable(),
  ratingAppearance: ratingSchema,
  ratingExpertise: ratingSchema,
  ratingCommunication: ratingSchema,
  ratingITSkill: ratingSchema,
  ratingAI: ratingSchema,
  ratingKnowledge: ratingSchema,
  scoreMultipleChoice: z.number().optional().nullable(),
  scoreWordProcessing: z.number().optional().nullable(),
  scoreTypingSpeed: z.number().optional().nullable(),
  typingWordsPerMinute: z.number().int().optional().nullable(),
  screeningResult: resultSchema,
  screeningNotes: z.string().optional().nullable(),

  // Phỏng vấn
  interviewDate: z.string().optional().nullable(),
  interviewScore: z.number().optional().nullable(),
  interviewNotes: z.string().optional().nullable(),

  notes: z.string().optional().nullable(),
});

export type ApplicationFields = z.infer<typeof applicationFieldsSchema>;

/**
 * Normalize a parsed payload into the shape Prisma expects. Trims strings,
 * casts dates, drops empty-string ids so we don't try to create FK to "".
 */
export function toPrismaPayload(input: ApplicationFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const trim = (v: string | null | undefined): string | null => {
    if (v === undefined || v === null) return null;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  const date = (v: string | null | undefined): Date | null => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  if ('fullName' in input && input.fullName !== undefined) out.fullName = trim(input.fullName);
  if ('dateOfBirth' in input) out.dateOfBirth = date(input.dateOfBirth ?? null);
  if ('birthPlace' in input) out.birthPlace = trim(input.birthPlace);
  if ('phone' in input) out.phone = trim(input.phone);
  if ('email' in input) out.email = trim(input.email);
  if ('permanentAddress' in input) out.permanentAddress = trim(input.permanentAddress);
  if ('temporaryAddress' in input) out.temporaryAddress = trim(input.temporaryAddress);
  if ('cvUrl' in input) out.cvUrl = trim(input.cvUrl);

  if ('education' in input) out.education = trim(input.education);
  if ('educationInstitution' in input) out.educationInstitution = trim(input.educationInstitution);
  if ('graduationYear' in input) out.graduationYear = input.graduationYear ?? null;
  if ('graduationRank' in input) out.graduationRank = trim(input.graduationRank);
  if ('trainingCertificate' in input) out.trainingCertificate = trim(input.trainingCertificate);
  if ('foreignLanguage' in input) out.foreignLanguage = trim(input.foreignLanguage);
  if ('itSkill' in input) out.itSkill = trim(input.itSkill);

  if ('appliedPosition' in input) out.appliedPosition = trim(input.appliedPosition);
  if ('workExperience' in input) out.workExperience = trim(input.workExperience);
  if ('previousSalary' in input) {
    const v = input.previousSalary;
    if (v === null || v === undefined) out.previousSalary = null;
    else if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      out.previousSalary = Number.isFinite(n) ? n : null;
    } else out.previousSalary = v;
  }
  if ('resignReason' in input) out.resignReason = trim(input.resignReason);

  if ('knowsHospital' in input) out.knowsHospital = input.knowsHospital ?? null;
  if ('hospitalRelative' in input) out.hospitalRelative = trim(input.hospitalRelative);

  if ('appliedTypeId' in input) out.appliedTypeId = trim(input.appliedTypeId);
  if ('desiredDepartmentId' in input) out.desiredDepartmentId = trim(input.desiredDepartmentId);
  if ('source' in input) out.source = trim(input.source);

  if ('screeningDate' in input) out.screeningDate = date(input.screeningDate ?? null);
  if ('screeningLocation' in input) out.screeningLocation = trim(input.screeningLocation);
  if ('screeningPanel' in input) out.screeningPanel = trim(input.screeningPanel);
  if ('ratingAppearance' in input) out.ratingAppearance = input.ratingAppearance ?? null;
  if ('ratingExpertise' in input) out.ratingExpertise = input.ratingExpertise ?? null;
  if ('ratingCommunication' in input) out.ratingCommunication = input.ratingCommunication ?? null;
  if ('ratingITSkill' in input) out.ratingITSkill = input.ratingITSkill ?? null;
  if ('ratingAI' in input) out.ratingAI = input.ratingAI ?? null;
  if ('ratingKnowledge' in input) out.ratingKnowledge = input.ratingKnowledge ?? null;
  if ('scoreMultipleChoice' in input) out.scoreMultipleChoice = input.scoreMultipleChoice ?? null;
  if ('scoreWordProcessing' in input) out.scoreWordProcessing = input.scoreWordProcessing ?? null;
  if ('scoreTypingSpeed' in input) out.scoreTypingSpeed = input.scoreTypingSpeed ?? null;
  if ('typingWordsPerMinute' in input) out.typingWordsPerMinute = input.typingWordsPerMinute ?? null;
  if ('screeningResult' in input) out.screeningResult = input.screeningResult ?? null;
  if ('screeningNotes' in input) out.screeningNotes = trim(input.screeningNotes);

  if ('interviewDate' in input) out.interviewDate = date(input.interviewDate ?? null);
  if ('interviewScore' in input) out.interviewScore = input.interviewScore ?? null;
  if ('interviewNotes' in input) out.interviewNotes = trim(input.interviewNotes);

  if ('notes' in input) out.notes = trim(input.notes);

  if ('status' in input && input.status !== undefined) out.status = input.status;

  return out;
}

/**
 * Workflow rule — if a screening result is PASS and we're still in SCREENING
 * status, push the applicant to the next phase automatically. Caller supplies
 * the current and proposed values (after the payload has been merged with
 * what's already in DB if this is an update).
 */
export function autoAdvanceStatus(args: {
  currentStatus: ApplicationStatus | undefined;
  proposedStatus: ApplicationStatus | undefined;
  proposedResult: ScreeningResult | null | undefined;
}): ApplicationStatus | undefined {
  // If the caller explicitly set a status (e.g. moving to ACCEPTED), respect that.
  if (args.proposedStatus && args.proposedStatus !== args.currentStatus) {
    return args.proposedStatus;
  }
  const effectiveStatus = args.proposedStatus ?? args.currentStatus;
  if (args.proposedResult === 'PASS' && effectiveStatus === 'SCREENING') {
    return 'INTERVIEW';
  }
  return args.proposedStatus;
}
