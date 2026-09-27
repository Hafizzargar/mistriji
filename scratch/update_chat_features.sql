-- Add new columns to support_messages
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_archived_by_user BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_archived_by_admin BOOLEAN DEFAULT FALSE;

-- Create a function to clean up old messages
CREATE OR REPLACE FUNCTION delete_old_support_messages()
RETURNS void AS $$
BEGIN
  -- Delete messages older than 15 days that are NOT bookmarked
  DELETE FROM public.support_messages
  WHERE created_at < NOW() - INTERVAL '15 days'
  AND is_bookmarked = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To automate this, you would enable pg_cron in Supabase and run:
-- SELECT cron.schedule('delete_old_messages', '0 0 * * *', $$SELECT delete_old_support_messages()$$);
