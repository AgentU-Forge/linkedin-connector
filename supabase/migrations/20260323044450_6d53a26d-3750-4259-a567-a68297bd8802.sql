
-- Jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'Full-time',
  description TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  deadline DATE,
  document_url TEXT,
  custom_fields JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs viewable by everyone" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Users can create jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

-- Job applications table
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  answers JSONB DEFAULT '{}',
  cv_url TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants can view own applications" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_id);
CREATE POLICY "Job posters can view applications" ON public.job_applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.jobs WHERE id = job_id AND user_id = auth.uid())
);
CREATE POLICY "Users can apply to jobs" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

-- Reposts table
CREATE TABLE public.reposts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reposted_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reposts viewable by everyone" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users can repost" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = reposted_by);
CREATE POLICY "Users can unrepost" ON public.reposts FOR DELETE USING (auth.uid() = reposted_by);

-- Storage bucket for job documents
INSERT INTO storage.buckets (id, name, public) VALUES ('job-documents', 'job-documents', true);

CREATE POLICY "Anyone can view job documents" ON storage.objects FOR SELECT USING (bucket_id = 'job-documents');
CREATE POLICY "Authenticated can upload job documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-documents' AND auth.uid() IS NOT NULL);

-- Storage bucket for CVs
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);

CREATE POLICY "Users can upload CVs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cvs' AND auth.uid() IS NOT NULL);
CREATE POLICY "Job posters can view CVs" ON storage.objects FOR SELECT USING (bucket_id = 'cvs' AND auth.uid() IS NOT NULL);

-- Enable realtime on notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Add update policy to likes (needed for switching reactions)
CREATE POLICY "Users can update own likes" ON public.likes FOR UPDATE USING (auth.uid() = user_id);
