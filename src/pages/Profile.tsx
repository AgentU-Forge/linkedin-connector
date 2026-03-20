import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, Pencil, Plus, MapPin, Globe, Briefcase, GraduationCap, X } from 'lucide-react';
import { toast } from 'sonner';
import PostCard from '@/components/PostCard';

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwn = user?.id === userId;
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', headline: '', summary: '', location: '', website: '', industry: '' });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ['experiences', userId],
    queryFn: async () => {
      const { data } = await supabase.from('experiences').select('*').eq('user_id', userId!).order('start_date', { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: education = [] } = useQuery({
    queryKey: ['education', userId],
    queryFn: async () => {
      const { data } = await supabase.from('education').select('*').eq('user_id', userId!).order('start_date', { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ['skills', userId],
    queryFn: async () => {
      const { data } = await supabase.from('skills').select('*').eq('user_id', userId!);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('posts').select('*').eq('user_id', userId!).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: connectionStatus } = useQuery({
    queryKey: ['connection-status', user?.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('connections')
        .select('*')
        .or(`and(requester_id.eq.${user!.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user!.id})`)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!userId && !isOwn,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from('profiles').update(updates).eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      setEditOpen(false);
      toast.success('Profile updated!');
    },
  });

  const sendConnectionRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('connections').insert({
        requester_id: user!.id,
        receiver_id: userId!,
      });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: userId!,
        actor_id: user!.id,
        type: 'connection_request',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      toast.success('Connection request sent!');
    },
  });

  const handleImageUpload = async (bucket: string, field: 'avatar_url' | 'cover_url', file: File) => {
    try {
      const url = await uploadFile(bucket, user!.id, file);
      await supabase.from('profiles').update({ [field]: url }).eq('user_id', user!.id);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      toast.success('Image updated!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="text-center py-8 text-muted-foreground">Profile not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header Card */}
      <Card className="overflow-hidden">
        <div className="relative h-48 bg-gradient-to-r from-primary/60 to-primary">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
          )}
          {isOwn && (
            <>
              <input type="file" ref={coverRef} className="hidden" accept="image/*"
                onChange={e => e.target.files?.[0] && handleImageUpload('covers', 'cover_url', e.target.files[0])} />
              <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-8 w-8"
                onClick={() => coverRef.current?.click()}>
                <Camera className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <CardContent className="p-6 -mt-16 relative">
          <div className="flex justify-between items-end">
            <div className="relative">
              <Avatar className="h-32 w-32 border-4 border-card">
                <AvatarImage src={profile.avatar_url || ''} />
                <AvatarFallback className="text-3xl">{profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              {isOwn && (
                <>
                  <input type="file" ref={avatarRef} className="hidden" accept="image/*"
                    onChange={e => e.target.files?.[0] && handleImageUpload('avatars', 'avatar_url', e.target.files[0])} />
                  <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                    onClick={() => avatarRef.current?.click()}>
                    <Camera className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isOwn ? (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setEditForm({
                      full_name: profile.full_name || '',
                      headline: profile.headline || '',
                      summary: profile.summary || '',
                      location: profile.location || '',
                      website: profile.website || '',
                      industry: profile.industry || '',
                    })}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Full name" value={editForm.full_name}
                        onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                      <Input placeholder="Headline" value={editForm.headline}
                        onChange={e => setEditForm(f => ({ ...f, headline: e.target.value }))} />
                      <Textarea placeholder="Summary / About" value={editForm.summary}
                        onChange={e => setEditForm(f => ({ ...f, summary: e.target.value }))} />
                      <Input placeholder="Location" value={editForm.location}
                        onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                      <Input placeholder="Website" value={editForm.website}
                        onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
                      <Input placeholder="Industry" value={editForm.industry}
                        onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} />
                      <Button onClick={() => updateProfile.mutate(editForm)} className="w-full">
                        Save
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <>
                  {!connectionStatus && (
                    <Button onClick={() => sendConnectionRequest.mutate()} size="sm">
                      Connect
                    </Button>
                  )}
                  {connectionStatus?.status === 'pending' && (
                    <Button variant="secondary" size="sm" disabled>Pending</Button>
                  )}
                  {connectionStatus?.status === 'accepted' && (
                    <Button variant="secondary" size="sm" disabled>Connected</Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-2xl font-bold">{profile.full_name || 'Your Name'}</h1>
            <p className="text-muted-foreground">{profile.headline}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {profile.location && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="h-3 w-3" />Website
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      {profile.summary && (
        <Card>
          <CardHeader><CardTitle className="text-lg">About</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{profile.summary}</p></CardContent>
        </Card>
      )}

      {/* Experience */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5" /> Experience</CardTitle>
          {isOwn && <AddExperience userId={user!.id} />}
        </CardHeader>
        <CardContent className="space-y-4">
          {experiences.map((exp: any) => (
            <div key={exp.id} className="flex gap-3">
              <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">{exp.title}</p>
                <p className="text-sm text-muted-foreground">{exp.company}</p>
                <p className="text-xs text-muted-foreground">{exp.start_date} – {exp.is_current ? 'Present' : exp.end_date}</p>
                {exp.description && <p className="text-sm mt-1">{exp.description}</p>}
              </div>
            </div>
          ))}
          {experiences.length === 0 && <p className="text-sm text-muted-foreground">No experience added yet.</p>}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Education</CardTitle>
          {isOwn && <AddEducation userId={user!.id} />}
        </CardHeader>
        <CardContent className="space-y-4">
          {education.map((edu: any) => (
            <div key={edu.id} className="flex gap-3">
              <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">{edu.school}</p>
                <p className="text-sm text-muted-foreground">{edu.degree}{edu.field_of_study ? `, ${edu.field_of_study}` : ''}</p>
                <p className="text-xs text-muted-foreground">{edu.start_date} – {edu.end_date || 'Present'}</p>
              </div>
            </div>
          ))}
          {education.length === 0 && <p className="text-sm text-muted-foreground">No education added yet.</p>}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Skills</CardTitle>
          {isOwn && <AddSkill userId={user!.id} />}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {skills.map((s: any) => (
              <span key={s.id} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
                {s.name}
              </span>
            ))}
            {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills added yet.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Activity</h2>
        {posts.map((post: any) => <PostCard key={post.id} post={post} />)}
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
      </div>
    </div>
  );
};

// Sub-components for adding experience, education, skills
const AddExperience: React.FC<{ userId: string }> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', start_date: '', end_date: '', description: '', is_current: false });

  const add = async () => {
    await supabase.from('experiences').insert({ ...form, user_id: userId });
    queryClient.invalidateQueries({ queryKey: ['experiences', userId] });
    setOpen(false);
    setForm({ title: '', company: '', location: '', start_date: '', end_date: '', description: '', is_current: false });
    toast.success('Experience added!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Experience</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} disabled={form.is_current} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} />
            Currently working here
          </label>
          <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Button onClick={add} className="w-full" disabled={!form.title || !form.company}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AddEducation: React.FC<{ userId: string }> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ school: '', degree: '', field_of_study: '', start_date: '', end_date: '' });

  const add = async () => {
    await supabase.from('education').insert({ ...form, user_id: userId });
    queryClient.invalidateQueries({ queryKey: ['education', userId] });
    setOpen(false);
    toast.success('Education added!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Education</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="School" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))} />
          <Input placeholder="Degree" value={form.degree} onChange={e => setForm(f => ({ ...f, degree: e.target.value }))} />
          <Input placeholder="Field of study" value={form.field_of_study} onChange={e => setForm(f => ({ ...f, field_of_study: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <Button onClick={add} className="w-full" disabled={!form.school}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AddSkill: React.FC<{ userId: string }> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const add = async () => {
    await supabase.from('skills').insert({ name, user_id: userId });
    queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    setOpen(false);
    setName('');
    toast.success('Skill added!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Skill</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Skill name" value={name} onChange={e => setName(e.target.value)} />
          <Button onClick={add} className="w-full" disabled={!name.trim()}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Profile;
