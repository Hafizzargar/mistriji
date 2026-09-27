
-- ============================================================
-- MistriJi — 012_notification_system.sql
-- Unified Notification System
-- ============================================================

CREATE TYPE notification_type AS ENUM ('booking_alert', 'job_update', 'system');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger Function: Generate Notifications on Job Changes
CREATE OR REPLACE FUNCTION handle_job_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec record;
BEGIN
  -- INSERT LOGIC
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending_dispatch' THEN
      -- Notify all admins
      FOR admin_rec IN SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') AND status = 'active' LOOP
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (admin_rec.id, 'Manual Dispatch Required', 'New booking in ' || NEW.area || ' requires manual dispatch.', 'booking_alert', NEW.id);
      END LOOP;
    ELSIF NEW.status = 'requested' AND NEW.requested_worker_id IS NOT NULL THEN
      -- Notify requested worker
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.requested_worker_id, 'Direct Booking Request', 'You have a new booking request in ' || NEW.area || '. Please accept quickly!', 'booking_alert', NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE LOGIC
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.customer_id, 'Mistri Accepted', 'A Mistri has accepted your booking and is on the way!', 'job_update', NEW.id);
    ELSIF NEW.status = 'admin_assigned' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.worker_id, 'Job Assigned', 'Admin has manually assigned you a job in ' || NEW.area || '.', 'booking_alert', NEW.id);
    ELSIF NEW.status = 'arrived' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.customer_id, 'Mistri Arrived', 'Your Mistri has arrived at your location.', 'job_update', NEW.id);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.customer_id, 'Job Completed', 'Your job has been marked as completed. Please pay ₹' || NEW.price, 'job_update', NEW.id);
    ELSIF NEW.status = 'cancelled' AND NEW.worker_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.worker_id, 'Job Cancelled', 'The customer has cancelled the booking.', 'job_update', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_job_notifications ON public.jobs;
CREATE TRIGGER trigger_job_notifications
AFTER INSERT OR UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION handle_job_notifications();
