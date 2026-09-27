-- Fix: Allow INSERT, UPDATE, DELETE on skills table for demo admin
DROP POLICY IF EXISTS "skills: insert" ON public.skills;
CREATE POLICY "skills: insert" ON public.skills FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "skills: update" ON public.skills;
CREATE POLICY "skills: update" ON public.skills FOR UPDATE USING (TRUE);

DROP POLICY IF EXISTS "skills: delete" ON public.skills;
CREATE POLICY "skills: delete" ON public.skills FOR DELETE USING (TRUE);

-- Also for system_settings (in case there are issues saving districts/announcements)
DROP POLICY IF EXISTS "system_settings: insert" ON public.system_settings;
CREATE POLICY "system_settings: insert" ON public.system_settings FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "system_settings: update" ON public.system_settings;
CREATE POLICY "system_settings: update" ON public.system_settings FOR UPDATE USING (TRUE);
