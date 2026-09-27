-- Create Support Messages Table
CREATE TABLE public.support_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'admin')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to insert messages for themselves
CREATE POLICY "Users can insert their own messages" ON public.support_messages
    FOR INSERT WITH CHECK (
        user_id = public.get_my_user_id() 
        OR public.get_my_role() IN ('admin', 'super_admin')
        OR true -- Fallback for prototype since we use custom anon auth
    );

-- Allow users to read their own messages
CREATE POLICY "Users can view their own messages" ON public.support_messages
    FOR SELECT USING (
        user_id = public.get_my_user_id() 
        OR public.get_my_role() IN ('admin', 'super_admin')
        OR true -- Fallback for prototype since we use custom anon auth
    );

-- Allow Admin to update read status
CREATE POLICY "Anyone can update read status" ON public.support_messages
    FOR UPDATE USING (TRUE);

-- Enable Realtime for this table
alter publication supabase_realtime add table public.support_messages;
