// ============================================================
// MistriJi — packages/types/src/index.ts
// All shared TypeScript types across web, admin, mobile
// ============================================================

// ─── Enums ───────────────────────────────────────────────────

export type UserRole =
  | 'customer'
  | 'worker'
  | 'employer'
  | 'admin'
  | 'super_admin';

export type AccountStatus = 'active' | 'pending' | 'suspended' | 'deleted';

export type PhoneType = 'smartphone' | 'keypad' | 'none';

export type EnrollmentMethod = 'field' | 'self_call' | 'employer' | 'sms' | 'app';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type EmployerWorkerStatus = 'active' | 'inactive' | 'removed';

export type JobStatus =
  | 'requested'
  | 'accepted'
  | 'on_way'
  | 'arrived'
  | 'working'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'upi' | 'pending';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

// ─── Core Models ─────────────────────────────────────────────

export interface User {
  id: string;
  auth_id: string | null;
  phone: string;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  name: string;
  photo_url: string | null;
  area: string | null;
  city: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerProfile {
  user_id: string;
  experience_years: number;
  is_available: boolean;
  verification_status: VerificationStatus;
  phone_type: PhoneType;
  enrollment_method: EnrollmentMethod;
  claimed: boolean;
  id_proof_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployerProfile {
  user_id: string;
  business_name: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployerWorker {
  id: string;
  employer_id: string;
  worker_id: string;
  status: EmployerWorkerStatus;
  joined_at: string;
}

export interface Skill {
  id: string;
  name: string;
  name_hi: string | null;
  icon: string | null;
  category: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WorkerSkill {
  id: string;
  worker_id: string;
  skill_id: string;
  experience_years: number;
}

export interface Job {
  id: string;
  customer_id: string;
  worker_id: string | null;
  employer_id: string | null;
  skill_id: string;
  status: JobStatus;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  preferred_time: string | null;
  description: string | null;
  price: number | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  worker_lat: number | null;
  worker_lng: number | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  job_id: string;
  from_user_id: string;
  to_user_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  target_type: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ─── Composite / View Types ───────────────────────────────────

/** Worker with their profile + skills for display */
export interface WorkerWithProfile {
  user: User;
  profile: Profile;
  worker_profile: WorkerProfile;
  skills: Array<Skill & { experience_years: number }>;
  avg_rating: number | null;
  total_jobs: number;
}

/** Job with all joined data for display */
export interface JobWithDetails {
  job: Job;
  customer: Profile;
  worker: Profile | null;
  skill: Skill;
  rating: Rating | null;
}

/** Admin dashboard stats */
export interface DashboardStats {
  total_workers: number;
  verified_workers: number;
  total_customers: number;
  total_jobs: number;
  active_jobs: number;
  completed_jobs_today: number;
}
