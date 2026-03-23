import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Briefcase, Search, Plus, MapPin, Clock, FileUp, X, Trash2, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface CustomField {
  label: string;
  type: 'text' | 'textarea' | 'file';
  required: boolean;
}

const Jobs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [postOpen, setPostOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const filteredJobs = jobs.filter((j: any) =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.company.toLowerCase().includes(search.toLowerCase()) ||
    j.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" /> Jobs
            </CardTitle>
            <Dialog open={postOpen} onOpenChange={setPostOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-full gap-1">
                  <Plus className="h-4 w-4" /> Post a Job
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Post a Job</DialogTitle></DialogHeader>
                <PostJobForm onSuccess={() => { setPostOpen(false); queryClient.invalidateQueries({ queryKey: ['jobs'] }); }} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search for jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading jobs...</p>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No jobs found</p>
              <p className="text-sm">Be the first to post a job opportunity!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job: any) => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const PostJobForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '', company: '', location: '', job_type: 'Full-time', description: '', deadline: '',
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { label: '', type: 'text', required: false }]);
  };

  const handleSubmit = async () => {
    if (!user || !form.title || !form.company || !form.description) return;
    setPosting(true);
    try {
      let docUrl = null;
      if (docFile) {
        docUrl = await uploadFile('job-documents', user.id, docFile);
      }
      await (supabase.from('jobs') as any).insert({
        user_id: user.id,
        title: form.title,
        company: form.company,
        location: form.location,
        job_type: form.job_type,
        description: form.description,
        skills,
        deadline: form.deadline || null,
        document_url: docUrl,
        custom_fields: customFields.filter(f => f.label.trim()),
      });
      toast.success('Job posted!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Job Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <Input placeholder="Company Name *" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
      <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
      <Select value={form.job_type} onValueChange={v => setForm(f => ({ ...f, job_type: v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Full-time">Full-time</SelectItem>
          <SelectItem value="Part-time">Part-time</SelectItem>
          <SelectItem value="Contract">Contract</SelectItem>
          <SelectItem value="Remote">Remote</SelectItem>
        </SelectContent>
      </Select>
      <Textarea placeholder="Job Description *" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="min-h-[100px]" />
      
      {/* Skills */}
      <div>
        <label className="text-sm font-medium mb-1 block">Required Skills</label>
        <div className="flex gap-2 mb-2">
          <Input placeholder="Add a skill" value={skillInput} onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
          <Button type="button" variant="outline" size="sm" onClick={addSkill}>Add</Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {skills.map((s, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {s}
              <button onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label className="text-sm font-medium mb-1 block">Application Deadline</label>
        <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
      </div>

      {/* Document */}
      <div>
        <label className="text-sm font-medium mb-1 block">Upload JD (PDF/DOC)</label>
        <input type="file" ref={docRef} className="hidden" accept=".pdf,.doc,.docx" onChange={e => setDocFile(e.target.files?.[0] || null)} />
        <Button variant="outline" size="sm" onClick={() => docRef.current?.click()} className="gap-1">
          <FileUp className="h-4 w-4" /> {docFile ? docFile.name : 'Choose file'}
        </Button>
      </div>

      {/* Custom Fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Custom Application Questions</label>
          <Button variant="outline" size="sm" onClick={addCustomField} className="gap-1">
            <Plus className="h-3 w-3" /> Add Question
          </Button>
        </div>
        {customFields.map((field, idx) => (
          <div key={idx} className="flex gap-2 mb-2 items-center">
            <Input placeholder="Question label" value={field.label}
              onChange={e => { const cf = [...customFields]; cf[idx].label = e.target.value; setCustomFields(cf); }} className="flex-1" />
            <Select value={field.type} onValueChange={v => { const cf = [...customFields]; cf[idx].type = v as any; setCustomFields(cf); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="textarea">Long Text</SelectItem>
                <SelectItem value="file">File Upload</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <input type="checkbox" checked={field.required}
                onChange={e => { const cf = [...customFields]; cf[idx].required = e.target.checked; setCustomFields(cf); }} />
              Required
            </label>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} disabled={!form.title || !form.company || !form.description || posting} className="w-full">
        {posting ? 'Posting...' : 'Post Job'}
      </Button>
    </div>
  );
};

const JobCard: React.FC<{ job: any }> = ({ job }) => {
  const { user } = useAuth();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: poster } = useQuery({
    queryKey: ['profile', job.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', job.user_id).single();
      return data;
    },
  });

  return (
    <div className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-base">{job.title}</h3>
          <p className="text-sm text-muted-foreground">{job.company}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
            <Badge variant="outline" className="text-xs">{job.job_type}</Badge>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
          </div>
          {job.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {job.skills.map((s: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
            </div>
          )}
          {job.deadline && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Deadline: {new Date(job.deadline).toLocaleDateString()}
            </p>
          )}
        </div>
        {user?.id !== job.user_id && (
          <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full ml-3">Apply</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Apply to {job.title}</DialogTitle></DialogHeader>
              <ApplyForm job={job} onSuccess={() => setApplyOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <p className="text-sm mt-2 text-muted-foreground line-clamp-3">{job.description}</p>
      {job.document_url && (
        <a href={job.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
          📄 View Job Description
        </a>
      )}
      <p className="text-xs text-muted-foreground mt-2">Posted by {poster?.full_name || 'Unknown'}</p>
    </div>
  );
};

const ApplyForm: React.FC<{ job: any; onSuccess: () => void }> = ({ job, onSuccess }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [fileAnswers, setFileAnswers] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const cvRef = useRef<HTMLInputElement>(null);

  const customFields: CustomField[] = (job.custom_fields as CustomField[]) || [];

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let cvUrl = null;
      if (cvFile) {
        cvUrl = await uploadFile('cvs', user.id, cvFile);
      }
      // Upload file answers
      const finalAnswers = { ...answers };
      for (const [key, file] of Object.entries(fileAnswers)) {
        if (file) {
          const url = await uploadFile('cvs', user.id, file);
          finalAnswers[key] = url;
        }
      }

      await supabase.from('job_applications').insert({
        job_id: job.id,
        applicant_id: user.id,
        answers: finalAnswers,
        cv_url: cvUrl,
      });
      await supabase.from('notifications').insert({
        user_id: job.user_id,
        actor_id: user.id,
        type: 'job_application',
        post_id: job.id,
      });
      toast.success('Application submitted!');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* CV Upload */}
      <div>
        <label className="text-sm font-medium mb-1 block">Upload CV *</label>
        <input type="file" ref={cvRef} className="hidden" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files?.[0] || null)} />
        <Button variant="outline" size="sm" onClick={() => cvRef.current?.click()} className="gap-1">
          <FileUp className="h-4 w-4" /> {cvFile ? cvFile.name : 'Choose CV'}
        </Button>
      </div>

      {/* Custom fields */}
      {customFields.map((field, idx) => (
        <div key={idx}>
          <label className="text-sm font-medium mb-1 block">
            {field.label} {field.required && <span className="text-destructive">*</span>}
          </label>
          {field.type === 'text' && (
            <Input value={answers[field.label] || ''} onChange={e => setAnswers(a => ({ ...a, [field.label]: e.target.value }))} />
          )}
          {field.type === 'textarea' && (
            <Textarea value={answers[field.label] || ''} onChange={e => setAnswers(a => ({ ...a, [field.label]: e.target.value }))} />
          )}
          {field.type === 'file' && (
            <Input type="file" onChange={e => setFileAnswers(fa => ({ ...fa, [field.label]: e.target.files?.[0] || null }))} />
          )}
        </div>
      ))}

      <Button onClick={handleSubmit} disabled={submitting || !cvFile} className="w-full">
        {submitting ? 'Submitting...' : 'Submit Application'}
      </Button>
    </div>
  );
};

export default Jobs;
