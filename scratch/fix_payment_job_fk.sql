ALTER TABLE public.payments 
  ADD CONSTRAINT fk_job
  FOREIGN KEY (job_id) 
  REFERENCES public.jobs(id) 
  ON DELETE SET NULL;
