
-- Create user_roles table for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: admins can see all roles, users can see their own
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create post-videos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('post-videos', 'post-videos', true);

-- Storage policy for post-videos
CREATE POLICY "Users can upload videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-videos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-videos');

-- Add video_url column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add unique constraint to prevent duplicate notifications
-- We'll use a function-based approach instead
CREATE OR REPLACE FUNCTION public.insert_unique_notification(
  p_user_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_post_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For reaction/like/comment/repost on same post by same actor, check if already notified
  IF p_post_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = p_user_id AND actor_id = p_actor_id AND type = p_type AND post_id = p_post_id
    ) THEN
      RETURN;
    END IF;
  ELSE
    -- For connection_request, message etc, check if already notified (no post_id)
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = p_user_id AND actor_id = p_actor_id AND type = p_type AND post_id IS NULL
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, post_id)
  VALUES (p_user_id, p_actor_id, p_type, p_post_id);
END;
$$;
