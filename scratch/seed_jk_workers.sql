-- =============================================================
-- MistriJi — J&K Workers Seed Data
-- Run this in Supabase Dashboard → SQL Editor
-- Seeds 20 verified workers across all J&K districts
-- =============================================================

-- Ensure lat/lng columns exist (safe to run even if already present)
ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6);
ALTER TABLE public.profiles        ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6);
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS lat DECIMAL(9,6);
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS lng DECIMAL(9,6);

-- Fix RLS: Allow public (anon) to read worker users, profiles, skills, ratings
-- Drop old restrictive policies if they exist, then create open ones
DROP POLICY IF EXISTS "users: read own row" ON public.users;
DROP POLICY IF EXISTS "users: admin reads non-superadmin" ON public.users;
DROP POLICY IF EXISTS "users: select" ON public.users;

-- Workers are publicly visible; admins see all; others see own row only
CREATE POLICY "users: select" ON public.users FOR SELECT USING (
  role = 'worker'
  OR id = get_my_user_id()
  OR auth_id = auth.uid()
  OR get_my_role() IN ('admin', 'super_admin')
);

-- Allow inserting new users (needed for customer booking flow)
DROP POLICY IF EXISTS "users: insert" ON public.users;
CREATE POLICY "users: insert" ON public.users FOR INSERT WITH CHECK (
  get_my_role() IN ('admin', 'super_admin') OR auth.uid() IS NOT NULL OR role = 'customer'
);

-- Ensure profiles & worker_profiles have open SELECT (already TRUE in master but may be missing)
DROP POLICY IF EXISTS "profiles: worker profile public read" ON public.profiles;
DROP POLICY IF EXISTS "profiles: select" ON public.profiles;
CREATE POLICY "profiles: select" ON public.profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "worker_profiles: public read" ON public.worker_profiles;
DROP POLICY IF EXISTS "worker_profiles: select" ON public.worker_profiles;
CREATE POLICY "worker_profiles: select" ON public.worker_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "worker_skills: select" ON public.worker_skills;
CREATE POLICY "worker_skills: select" ON public.worker_skills FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "ratings: select" ON public.ratings;
CREATE POLICY "ratings: select" ON public.ratings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "skills: select" ON public.skills;
CREATE POLICY "skills: select" ON public.skills FOR SELECT USING (is_active = TRUE OR get_my_role() IN ('admin', 'super_admin'));

-- Allow anon to insert jobs and customer users (for booking flow)
DROP POLICY IF EXISTS "jobs: select" ON public.jobs;
CREATE POLICY "jobs: select" ON public.jobs FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "jobs: insert" ON public.jobs;
CREATE POLICY "jobs: insert" ON public.jobs FOR INSERT WITH CHECK (TRUE);


DO $$
DECLARE
  v_admin_id    UUID;
  v_user_id     UUID;
  v_job_id      UUID;
  phones         TEXT[]   := ARRAY['9858000001','9858000002','9858000003','9858000004','9858000005',
                                   '9858000006','9858000007','9858000008','9858000009','9858000010',
                                   '9858000011','9858000012','9858000013','9858000014','9858000015',
                                   '9858000016','9858000017','9858000018','9858000019','9858000020'];
  names          TEXT[]   := ARRAY['Tariq Ahmed','Vikram Singh','Sunil Kumar','Mohammad Ashraf','Ghulam Hassan',
                                   'Shabir Ahmed Bhat','Bilal Ahmed','Ramesh Sharma','Rakesh Kumar','Manzoor Ali',
                                   'Gurdeep Singh','Suraj Prakash','Anil Gupta','Riyaz Ahmed','Deepak Sharma',
                                   'Mushtaq Ahmad','Vikas Verma','Zahoor Hussain','Amar Jyoti','Noor Mohammad'];
  areas          TEXT[]   := ARRAY['Bhaderwah','Doda','Katra','Udhampur','Srinagar',
                                   'Anantnag','Baramulla','Gandhi Nagar','Satwari','Janipur',
                                   'RS Pura','Kathua','Trikuta Nagar','Baramulla','Jewel Chowk',
                                   'Pulwama','Samba','Rajouri','Bakshi Nagar','Anantnag'];
  lats           FLOAT[]  := ARRAY[32.9810,33.1450,32.9910,32.9260,34.0837,
                                   33.7310,34.2010,32.7081,32.6890,32.7550,
                                   32.6030,32.3710,32.7020,34.2010,32.7270,
                                   33.8720,32.5620,33.3810,32.7380,33.7310];
  lngs           FLOAT[]  := ARRAY[75.7120,75.5460,74.9310,75.1410,74.7973,
                                   75.1480,74.3420,74.8711,74.8450,74.8490,
                                   74.7330,75.5210,74.8780,74.3420,74.8570,
                                   74.8950,75.1160,74.3120,74.8480,75.1480];
  exp_years      INT[]    := ARRAY[8,6,5,10,12,7,4,9,11,6,14,3,7,5,8,6,9,11,4,13];
  ratings        INT[]    := ARRAY[5,5,5,5,5,5,4,5,5,4,5,4,5,4,5,4,5,5,4,5];
  skill1_ids     UUID[]   := ARRAY[
    '077f8217-8962-42ad-81e3-b5a40c15f2ef'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID,
    '5aa628e4-02bb-49fa-8798-97ee9835db68'::UUID,
    'a094243f-2956-4ba8-9745-23f6a66c5a52'::UUID,
    '006edaa4-2581-4021-959f-1c3af2f965d8'::UUID,
    '2d129f98-989a-4cfc-b8bb-d5b7f6b27e0c'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID,
    '077f8217-8962-42ad-81e3-b5a40c15f2ef'::UUID,
    '2d129f98-989a-4cfc-b8bb-d5b7f6b27e0c'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID,
    'd768624e-0e36-4b75-ad13-ccfb1528ef3a'::UUID,
    '6395d5db-3dc3-485d-aa38-e43411813d74'::UUID,
    '077f8217-8962-42ad-81e3-b5a40c15f2ef'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID,
    'a094243f-2956-4ba8-9745-23f6a66c5a52'::UUID,
    '077f8217-8962-42ad-81e3-b5a40c15f2ef'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID,
    '006edaa4-2581-4021-959f-1c3af2f965d8'::UUID,
    '6395d5db-3dc3-485d-aa38-e43411813d74'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID
  ];
  skill2_ids     UUID[]   := ARRAY[
    '2d129f98-989a-4cfc-b8bb-d5b7f6b27e0c'::UUID,
    '006edaa4-2581-4021-959f-1c3af2f965d8'::UUID,
    '077f8217-8962-42ad-81e3-b5a40c15f2ef'::UUID,
    '5e7b27bc-7cb5-4119-8f6c-73a012169486'::UUID,
    'a094243f-2956-4ba8-9745-23f6a66c5a52'::UUID,
    '077f8217-8962-42ad-81e3-b5a40c15f2ef'::UUID,
    '6395d5db-3dc3-485d-aa38-e43411813d74'::UUID,
    '5aa628e4-02bb-49fa-8798-97ee9835db68'::UUID,
    NULL::UUID,
    '006edaa4-2581-4021-959f-1c3af2f965d8'::UUID,
    '73bb3cd6-d7af-492b-a93e-027993ef226a'::UUID,
    'a094243f-2956-4ba8-9745-23f6a66c5a52'::UUID,
    '2d129f98-989a-4cfc-b8bb-d5b7f6b27e0c'::UUID,
    '006edaa4-2581-4021-959f-1c3af2f965d8'::UUID,
    '5e7b27bc-7cb5-4119-8f6c-73a012169486'::UUID,
    NULL::UUID,
    'd768624e-0e36-4b75-ad13-ccfb1528ef3a'::UUID,
    'a094243f-2956-4ba8-9745-23f6a66c5a52'::UUID,
    '5e7b27bc-7cb5-4119-8f6c-73a012169486'::UUID,
    '006edaa4-2581-4021-959f-1c3af2f965d8'::UUID
  ];
  comments       TEXT[]   := ARRAY[
    'Exceptional electrical wiring work in Bhaderwah bazaar!',
    'Great masonry & stone work construction in Doda.',
    'Fixed hotel AC unit in Katra fast and efficiently.',
    'Excellent house painting and deep cleaning in Udhampur town.',
    'Expert wood carving and timber fitting in Lal Chowk Srinagar.',
    'Super fast plumbing leak repair in Anantnag.',
    'Hardworking helper and brick mason in Baramulla.',
    'Very professional electrician in Gandhi Nagar Jammu.',
    'Top quality pipe fitting near Satwari airport.',
    'Solid carpentry work done near High Court Janipur.',
    'Heavy welding and iron gate fabrication in RS Pura.',
    'Reliable painter in Kathua town.',
    'Fast and reliable work in Trikuta Nagar.',
    'Good masonry work in Sopore market area.',
    'Neat and tidy painting in old city Jammu.',
    'Dependable electrical work in Pulwama district.',
    'Strong construction and iron work in Samba.',
    'Excellent wooden door and window fitting in Rajouri.',
    'Quick and clean domestic helper near GMC Jammu.',
    'Expert craftsman in Anantnag for over a decade.'
  ];
  i INT;
BEGIN
  -- Get super_admin for dummy job customer_id
  SELECT id INTO v_admin_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.users LIMIT 1;
  END IF;

  FOR i IN 1..array_length(phones, 1) LOOP
    SELECT id INTO v_user_id FROM public.users WHERE phone = phones[i];

    IF v_user_id IS NULL THEN
      INSERT INTO public.users (phone, role, status)
      VALUES (phones[i], 'worker', 'active')
      RETURNING id INTO v_user_id;
    END IF;

    INSERT INTO public.profiles (user_id, name, area, city, lat, lng)
    VALUES (v_user_id, names[i], areas[i], areas[i], lats[i], lngs[i])
    ON CONFLICT (user_id) DO UPDATE
      SET name=EXCLUDED.name, area=EXCLUDED.area, city=EXCLUDED.city, lat=EXCLUDED.lat, lng=EXCLUDED.lng;

    INSERT INTO public.worker_profiles (user_id, experience_years, is_available, verification_status, phone_type, enrollment_method, claimed, lat, lng)
    VALUES (v_user_id, exp_years[i], true, 'verified', 'smartphone', 'field', true, lats[i], lngs[i])
    ON CONFLICT (user_id) DO UPDATE
      SET experience_years=EXCLUDED.experience_years, is_available=true, verification_status='verified',
          lat=EXCLUDED.lat, lng=EXCLUDED.lng;

    INSERT INTO public.worker_skills (worker_id, skill_id, experience_years)
    VALUES (v_user_id, skill1_ids[i], exp_years[i])
    ON CONFLICT (worker_id, skill_id) DO NOTHING;

    IF skill2_ids[i] IS NOT NULL THEN
      INSERT INTO public.worker_skills (worker_id, skill_id, experience_years)
      VALUES (v_user_id, skill2_ids[i], exp_years[i])
      ON CONFLICT (worker_id, skill_id) DO NOTHING;
    END IF;

    IF v_admin_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.jobs WHERE worker_id = v_user_id LIMIT 1
    ) THEN
      INSERT INTO public.jobs (customer_id, worker_id, skill_id, status, address, area, price)
      VALUES (v_admin_id, v_user_id, skill1_ids[i], 'completed', areas[i] || ' Main Market, J&K', areas[i], 600)
      RETURNING id INTO v_job_id;

      INSERT INTO public.ratings (job_id, from_user_id, to_user_id, score, comment)
      VALUES (v_job_id, v_admin_id, v_user_id, ratings[i], comments[i]);
    END IF;

    RAISE NOTICE 'Seeded: % (%) id=%', names[i], areas[i], v_user_id;
  END LOOP;

  RAISE NOTICE 'Done! Seeded % J&K workers.', array_length(phones, 1);
END $$;

-- Quick verification — run this after the block above succeeds
SELECT u.phone, p.name, p.area,
  wp.verification_status,
  (SELECT string_agg(s.name, ', ') FROM worker_skills ws JOIN skills s ON s.id=ws.skill_id WHERE ws.worker_id=u.id) AS skills,
  (SELECT AVG(r.score) FROM ratings r WHERE r.to_user_id=u.id) AS avg_rating
FROM users u
JOIN profiles p ON p.user_id=u.id
JOIN worker_profiles wp ON wp.user_id=u.id
WHERE u.role='worker'
ORDER BY p.area;
