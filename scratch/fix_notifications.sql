-- ============================================================
-- MistriJi: Fix Notifications, Service Requests & Support Chat
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Ensure notification_type enum supports chat messages
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'chat_message';

-- 2. Ensure RLS policies on notifications allow read/write for custom auth
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications: select" ON public.notifications;
DROP POLICY IF EXISTS "notifications: insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications: update" ON public.notifications;
DROP POLICY IF EXISTS "notifications: delete" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;

CREATE POLICY "notifications: select" ON public.notifications FOR SELECT USING (TRUE);
CREATE POLICY "notifications: insert" ON public.notifications FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "notifications: update" ON public.notifications FOR UPDATE USING (TRUE);
CREATE POLICY "notifications: delete" ON public.notifications FOR DELETE USING (TRUE);

-- 3. Ensure Realtime is enabled for notifications and chat
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
  END;
END $$;

-- 4. Fix Job Notification Trigger (Handles 'requested', 'pending_dispatch', etc.)
CREATE OR REPLACE FUNCTION handle_job_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec record;
  skill_name text;
BEGIN
  -- INSERT LOGIC (When a new job booking is created)
  IF TG_OP = 'INSERT' THEN
    -- Get skill name if available
    SELECT name INTO skill_name FROM public.skills WHERE id = NEW.skill_id;
    IF skill_name IS NULL THEN
      skill_name := 'Service';
    END IF;

    IF NEW.status = 'pending_dispatch' THEN
      -- Manual dispatch mode: notify all admins
      FOR admin_rec IN SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') AND status = 'active' LOOP
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (admin_rec.id, 'Manual Dispatch Required', 'New ' || skill_name || ' booking in ' || NEW.area || ' requires manual dispatch.', 'booking_alert', NEW.id);
      END LOOP;
    ELSIF NEW.status = 'requested' THEN
      -- Auto-broadcast mode: notify all admins of new request
      FOR admin_rec IN SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') AND status = 'active' LOOP
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (admin_rec.id, 'New Service Request', 'New ' || skill_name || ' booking requested in ' || NEW.area || '.', 'booking_alert', NEW.id);
      END LOOP;

      -- If directly requested to a specific worker, notify the worker too
      IF NEW.requested_worker_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (NEW.requested_worker_id, 'Direct Booking Request', 'You have a new ' || skill_name || ' request in ' || NEW.area || '. Please accept quickly!', 'booking_alert', NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE LOGIC (When job status changes)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.customer_id, 'Mistri Accepted', 'A Mistri has accepted your booking and is on the way!', 'job_update', NEW.id);
    ELSIF NEW.status = 'admin_assigned' AND NEW.worker_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.worker_id, 'Job Assigned', 'Admin has assigned you a job in ' || NEW.area || '.', 'booking_alert', NEW.id);
    ELSIF NEW.status = 'arrived' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.customer_id, 'Mistri Arrived', 'Your Mistri has arrived at your location.', 'job_update', NEW.id);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (NEW.customer_id, 'Job Completed', 'Your job has been marked as completed.' || CASE WHEN NEW.price IS NOT NULL THEN ' Amount: ₹' || NEW.price ELSE '' END, 'job_update', NEW.id);
    ELSIF NEW.status = 'cancelled' THEN
      IF NEW.worker_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_id)
        VALUES (NEW.worker_id, 'Job Cancelled', 'The booking in ' || NEW.area || ' has been cancelled.', 'job_update', NEW.id);
      END IF;
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

-- 5. Trigger for Support Chat Notifications (Groups chat messages into single notification)
CREATE OR REPLACE FUNCTION handle_chat_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec record;
  customer_name TEXT;
  existing_notif_id UUID;
BEGIN
  -- When a CUSTOMER sends a message -> Notify all active Admins (Grouped into 1 unread notification per user)
  IF TG_OP = 'INSERT' AND NEW.sender = 'user' THEN
    SELECT name INTO customer_name FROM public.profiles WHERE user_id = NEW.user_id;
    IF customer_name IS NULL OR customer_name = '' THEN
      customer_name := 'A Customer';
    END IF;

    FOR admin_rec IN SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') AND status = 'active' LOOP
      -- Check if admin already has an unread chat notification from this specific user
      SELECT id INTO existing_notif_id 
      FROM public.notifications 
      WHERE user_id = admin_rec.id 
        AND type = 'chat_message' 
        AND reference_id = NEW.user_id 
        AND is_read = false 
      LIMIT 1;

      IF existing_notif_id IS NOT NULL THEN
        -- Update the existing unread notification with latest text and fresh timestamp
        UPDATE public.notifications
        SET message = customer_name || ': ' || substring(NEW.content from 1 for 60),
            created_at = NOW()
        WHERE id = existing_notif_id;
      ELSE
        -- Insert a new unread notification
        INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
        VALUES (
          admin_rec.id, 
          'New Support Message', 
          customer_name || ': ' || substring(NEW.content from 1 for 60), 
          'chat_message', 
          NEW.user_id,
          false,
          NOW()
        );
      END IF;
    END LOOP;

  -- When an ADMIN sends a message -> Notify the Customer (Grouped into 1 unread notification)
  ELSIF TG_OP = 'INSERT' AND NEW.sender = 'admin' THEN
    SELECT id INTO existing_notif_id 
    FROM public.notifications 
    WHERE user_id = NEW.user_id 
      AND type = 'chat_message' 
      AND is_read = false 
    LIMIT 1;

    IF existing_notif_id IS NOT NULL THEN
      -- Update existing unread notification
      UPDATE public.notifications
      SET message = 'MistriJi Support: ' || substring(NEW.content from 1 for 60),
          created_at = NOW()
      WHERE id = existing_notif_id;
    ELSE
      -- Insert new unread notification
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read, created_at)
      VALUES (
        NEW.user_id,
        'Support Reply',
        'MistriJi Support: ' || substring(NEW.content from 1 for 60),
        'chat_message',
        NEW.user_id,
        false,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chat_notifications ON public.support_messages;
CREATE TRIGGER trigger_chat_notifications
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION handle_chat_notifications();

-- 6. Helper RPC function for manual admin notifications
CREATE OR REPLACE FUNCTION notify_admins(
  p_title TEXT,
  p_message TEXT,
  p_type notification_type DEFAULT 'system',
  p_reference_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_rec record;
BEGIN
  FOR admin_rec IN SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') AND status = 'active' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (admin_rec.id, p_title, p_message, p_type, p_reference_id);
  END LOOP;
END;
$$;
