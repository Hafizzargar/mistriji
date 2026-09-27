// ============================================================
// MistriJi — packages/validation/src/index.ts
// All shared Zod validation schemas
// ============================================================

import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const pinSchema = z
  .string()
  .length(6, 'PIN must be exactly 6 digits')
  .regex(/^\d{6}$/, 'PIN must contain only numbers');

export const otpSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only numbers');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(60, 'Name must be less than 60 characters');

// ─── Auth ─────────────────────────────────────────────────────

export const loginSchema = z.object({
  phone: phoneSchema,
  pin:   pinSchema,
});

export const registerCustomerSchema = z.object({
  phone: phoneSchema,
  name:  nameSchema,
  area:  z.string().trim().min(2, 'Area is required'),
  otp:   otpSchema,
  pin:   pinSchema,
  pin_confirm: pinSchema,
}).refine((d) => d.pin === d.pin_confirm, {
  message: 'PINs do not match',
  path: ['pin_confirm'],
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp:   otpSchema,
});

export const changePinSchema = z.object({
  old_pin:     pinSchema,
  new_pin:     pinSchema,
  pin_confirm: pinSchema,
}).refine((d) => d.new_pin === d.pin_confirm, {
  message: 'New PINs do not match',
  path: ['pin_confirm'],
});

// ─── Worker Enrollment (Admin) ────────────────────────────────

export const workerEnrollSchema = z.object({
  name:              nameSchema,
  phone:             phoneSchema,
  skills:            z.array(z.string().uuid()).min(1, 'Select at least one skill'),
  experience_years:  z.coerce.number().int().min(0).max(50),
  area:              z.string().trim().min(2, 'Area is required'),
  city:              z.string().default('Jammu'),
  phone_type:        z.enum(['smartphone', 'keypad', 'none']),
  enrollment_method: z.enum(['field', 'self_call', 'employer', 'sms', 'app']),
  id_proof_url:      z.string().url().optional().or(z.literal('')),
  notes:             z.string().max(300).optional(),
});

export type WorkerEnrollValues = z.infer<typeof workerEnrollSchema>;

// ─── Customer Booking ─────────────────────────────────────────

export const bookingSchema = z.object({
  skill_id:       z.string().uuid('Please select a valid service'),
  address:        z.string().trim().min(5, 'Enter your complete address').max(200),
  area:           z.string().trim().min(2, 'Area is required'),
  preferred_time: z.string().datetime({ message: 'Select a valid date and time' }),
  description:    z.string().max(500, 'Description too long').optional(),
  payment_method: z.enum(['cash', 'upi']),
});

export type BookingValues = z.infer<typeof bookingSchema>;

// ─── Job Status Update (Admin / Worker) ──────────────────────

export const jobStatusUpdateSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(['accepted', 'on_way', 'arrived', 'working', 'completed', 'cancelled']),
  note:   z.string().max(200).optional(),
  price:  z.coerce.number().positive().optional(),
});

export type JobStatusUpdateValues = z.infer<typeof jobStatusUpdateSchema>;

// ─── Rating ───────────────────────────────────────────────────

export const ratingSchema = z.object({
  job_id:  z.string().uuid(),
  score:   z.coerce.number().int().min(1, 'Rating required').max(5),
  comment: z.string().max(300, 'Comment too long').optional(),
});

export type RatingValues = z.infer<typeof ratingSchema>;

// ─── Admin: Create Admin User ─────────────────────────────────

export const createAdminSchema = z.object({
  phone: phoneSchema,
  name:  nameSchema,
  role:  z.enum(['admin']),  // super_admin cannot be created via UI
});

export type CreateAdminValues = z.infer<typeof createAdminSchema>;

// ─── Profile Update ───────────────────────────────────────────

export const updateProfileSchema = z.object({
  name:      nameSchema,
  area:      z.string().trim().min(2, 'Area is required'),
  photo_url: z.string().url().optional().or(z.literal('')),
});

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;

// ─── Skill Management (Super Admin) ──────────────────────────

export const skillSchema = z.object({
  name:      z.string().trim().min(2).max(60),
  name_hi:   z.string().trim().max(60).optional(),
  icon:      z.string().max(10).optional(),
  category:  z.string().trim().min(2).max(40),
  sort_order: z.coerce.number().int().min(0),
  is_active: z.boolean().default(true),
});

export type SkillValues = z.infer<typeof skillSchema>;

// ─── Error message mapper (Supabase → Human readable) ────────

export const mapSupabaseError = (code: string | undefined): string => {
  const map: Record<string, string> = {
    'PGRST116':       'No account found with this number.',
    '23505':          'This phone number is already registered.',
    '23503':          'Invalid reference — please try again.',
    'invalid_grant':  'Invalid OTP or OTP has expired. Please try again.',
    'over_email_send_rate_limit': 'Too many OTP requests. Wait a minute and try again.',
    'network':        'Check your internet connection and try again.',
  };
  return code ? (map[code] ?? 'Something went wrong. Please try again.') : 'Something went wrong.';
};
