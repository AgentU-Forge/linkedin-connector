import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Camera, Pencil, Plus, MapPin, Globe, Briefcase, GraduationCap,
  Eye, BarChart3, Search, Users, MessageSquare, ChevronRight, Shield, Star, Trash2,
  ChevronUp, ChevronDown, Send, Bookmark, Activity, Info, FileText, Award, FolderOpen, BookOpen, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import PostCard from '@/components/PostCard';
import CreatePost from '@/components/CreatePost';

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isOwn = user?.id === userId;
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

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

  const { data: connectionCount = 0 } = useQuery({
    queryKey: ['connection-count', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
      return count || 0;
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
        requester_id: user!.id, receiver_id: userId!,
      });
      if (error) throw error;
      await supabase.rpc('insert_unique_notification', {
        p_user_id: userId!, p_actor_id: user!.id, p_type: 'connection_request',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      toast.success('Connection request sent!');
    },
  });

  const cancelConnectionRequest = useMutation({
    mutationFn: async () => {
      if (!connectionStatus) return;
      await supabase.from('connections').delete().eq('id', connectionStatus.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      toast.success('Request cancelled');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connectionStatus) return;
      await supabase.from('connections').delete().eq('id', connectionStatus.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connection-count'] });
      setDisconnectOpen(false);
      toast.success('Connection removed');
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-5xl mx-auto">
      <div className="lg:col-span-8 space-y-2">
        {/* Header Card */}
        <Card className="overflow-hidden">
          <div className="relative h-48 bg-gradient-to-r from-primary/60 to-primary">
            {profile.cover_url && <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />}
            {isOwn && (
              <>
                <input type="file" ref={coverRef} className="hidden" accept="image/*"
                  onChange={e => e.target.files?.[0] && handleImageUpload('covers', 'cover_url', e.target.files[0])} />
                <Button size="sm" variant="secondary" className="absolute top-3 right-3 gap-1 rounded-full"
                  onClick={() => coverRef.current?.click()}>
                  <Camera className="h-4 w-4" /> Edit cover
                </Button>
              </>
            )}
          </div>
          <CardContent className="px-6 pb-6 -mt-16 relative">
            <div className="flex justify-between items-start">
              <div className="relative">
                <Avatar className="h-36 w-36 border-4 border-card shadow-md">
                  <AvatarImage src={profile.avatar_url || ''} />
                  <AvatarFallback className="text-4xl">{profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                {isOwn && (
                  <>
                    <input type="file" ref={avatarRef} className="hidden" accept="image/*"
                      onChange={e => e.target.files?.[0] && handleImageUpload('avatars', 'avatar_url', e.target.files[0])} />
                    <Button size="icon" variant="secondary" className="absolute bottom-2 right-2 h-8 w-8 rounded-full shadow"
                      onClick={() => avatarRef.current?.click()}>
                      <Camera className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              {isOwn && (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="mt-20"
                      onClick={() => setEditForm({
                        full_name: profile.full_name || '', headline: profile.headline || '',
                        summary: profile.summary || '', location: profile.location || '',
                        website: profile.website || '', industry: profile.industry || '',
                      })}>
                      <Pencil className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
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
                      <Button onClick={() => updateProfile.mutate(editForm)} className="w-full">Save</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="mt-3">
              <h1 className="text-2xl font-bold">{profile.full_name || 'Your Name'}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{profile.headline || 'Add a headline'}</p>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                {profile.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    <Globe className="h-3 w-3" />Contact info
                  </a>
                )}
              </div>
              <Link to="/network" className="text-sm text-primary font-semibold hover:underline mt-1 inline-block">
                {connectionCount} connections
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              {isOwn ? (
                <>
                  <Button size="sm" className="rounded-full" onClick={() => {
                    setEditForm({
                      full_name: profile.full_name || '', headline: profile.headline || '',
                      summary: profile.summary || '', location: profile.location || '',
                      website: profile.website || '', industry: profile.industry || '',
                    });
                    setEditOpen(true);
                  }}>Edit Profile</Button>
                  <AddSectionDropdown userId={user!.id} profile={profile} setEditOpen={setEditOpen} setEditForm={setEditForm} />
                  <ResourcesDropdown userId={userId!} profile={profile} />
                </>
              ) : (
                <>
                  {!connectionStatus && (
                    <Button size="sm" className="rounded-full" onClick={() => sendConnectionRequest.mutate()}>
                      <Users className="h-4 w-4 mr-1" /> Connect
                    </Button>
                  )}
                  {connectionStatus?.status === 'pending' && connectionStatus.requester_id === user?.id && (
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => cancelConnectionRequest.mutate()}>
                      Pending
                    </Button>
                  )}
                  {connectionStatus?.status === 'pending' && connectionStatus.receiver_id === user?.id && (
                    <Button variant="secondary" size="sm" className="rounded-full" disabled>
                      Respond in Notifications
                    </Button>
                  )}
                  {connectionStatus?.status === 'accepted' && (
                    <>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDisconnectOpen(true)}>
                        <Users className="h-4 w-4 mr-1" /> Connected
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate('/messaging')}>
                        <MessageSquare className="h-4 w-4 mr-1" /> Message
                      </Button>
                    </>
                  )}
                  {!connectionStatus?.status || connectionStatus?.status === 'pending' ? (
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate('/messaging')}>
                      <MessageSquare className="h-4 w-4 mr-1" /> Message
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Disconnect Confirmation Dialog */}
        <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Remove Connection</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to remove {profile.full_name} from your connections?</p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setDisconnectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => disconnectMutation.mutate()}>Yes, Remove</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Suggested for you */}
        {isOwn && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Suggested for you</CardTitle>
              <p className="text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3 inline" /> Private to you</span>
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-sm">Which industry do you work in?</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Members who add an industry receive up to 2.5x more profile views.</p>
                  <Button variant="outline" size="sm" className="rounded-full text-primary border-primary" onClick={() => {
                    setEditForm({ full_name: profile.full_name || '', headline: profile.headline || '', summary: profile.summary || '', location: profile.location || '', website: profile.website || '', industry: profile.industry || '' });
                    setEditOpen(true);
                  }}>Add industry</Button>
                </div>
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-sm">Write a summary</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Members who include a summary receive up to 3.9x more profile views.</p>
                  <Button variant="outline" size="sm" className="rounded-full text-primary border-primary" onClick={() => {
                    setEditForm({ full_name: profile.full_name || '', headline: profile.headline || '', summary: profile.summary || '', location: profile.location || '', website: profile.website || '', industry: profile.industry || '' });
                    setEditOpen(true);
                  }}>Add a summary</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics */}
        {isOwn && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Analytics</CardTitle>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Private to you</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{connectionCount} profile views</p>
                    <p className="text-xs text-muted-foreground">Discover who's viewed your profile.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{posts.length} post impressions</p>
                    <p className="text-xs text-muted-foreground">Start a post to increase engagement.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Search className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">0 search appearances</p>
                    <p className="text-xs text-muted-foreground">See how often you appear in search.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* About */}
        {profile.summary && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">About</CardTitle>
              {isOwn && (
                <Button variant="ghost" size="icon" onClick={() => {
                  setEditForm({ full_name: profile.full_name || '', headline: profile.headline || '', summary: profile.summary || '', location: profile.location || '', website: profile.website || '', industry: profile.industry || '' });
                  setEditOpen(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{profile.summary}</p></CardContent>
          </Card>
        )}

        {/* Activity */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Activity</CardTitle>
              <p className="text-xs text-muted-foreground">{posts.length} posts</p>
            </div>
            {isOwn && (
              <CreatePost trigger={
                <Button size="sm" variant="outline" className="rounded-full">
                  <Plus className="h-4 w-4 mr-1" /> Create a post
                </Button>
              } />
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {posts.slice(0, 3).map((post: any) => <PostCard key={post.id} post={post} />)}
            {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
            {posts.length > 3 && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                Show all posts <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Experience */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-5 w-5" /> Experience</CardTitle>
            {isOwn && <AddExperience userId={user!.id} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {experiences.map((exp: any) => (
              <ExperienceItem key={exp.id} exp={exp} isOwn={isOwn} userId={userId!} />
            ))}
            {experiences.length === 0 && <p className="text-sm text-muted-foreground">No experience added yet.</p>}
          </CardContent>
        </Card>

        {/* Education */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Education</CardTitle>
            {isOwn && <AddEducation userId={user!.id} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {education.map((edu: any) => (
              <EducationItem key={edu.id} edu={edu} isOwn={isOwn} userId={userId!} />
            ))}
            {education.length === 0 && <p className="text-sm text-muted-foreground">No education added yet.</p>}
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-5 w-5" /> Skills</CardTitle>
            {isOwn && <AddSkill userId={user!.id} />}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {skills.map((s: any) => (
                <SkillItem key={s.id} skill={s} isOwn={isOwn} userId={userId!} />
              ))}
              {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills added yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar */}
      <aside className="lg:col-span-4 space-y-2 hidden lg:block">
        <Card className="sticky top-20">
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-1">Profile language</h3>
              <p className="text-xs text-muted-foreground">English</p>
            </div>
            <div className="border-t pt-3">
              <h3 className="font-semibold text-sm mb-1">Public profile & URL</h3>
              <p className="text-xs text-muted-foreground break-all">{window.location.origin}/profile/{userId}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">People you may know</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Connect with others to grow your network.</p>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => navigate('/network')}>
              Show all <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
};

// Resources Dropdown
const ResourcesDropdown: React.FC<{ userId: string; profile: any }> = ({ userId, profile }) => {
  const navigate = useNavigate();

  const handleSendProfile = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${userId}`);
    toast.success('Profile link copied! You can paste it in a message.');
    navigate('/messaging');
  };

  const handleSavePDF = async () => {
    toast.info('Generating PDF...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const element = document.querySelector('.max-w-5xl') as HTMLElement;
      if (!element) { toast.error('Could not capture profile'); return; }
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${profile.full_name || 'profile'}-cv.pdf`);
      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${userId}`);
    toast.success('Profile link copied!');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">Resources</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={handleSendProfile} className="gap-2 cursor-pointer">
          <Send className="h-4 w-4" /> Send profile in a message
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSavePDF} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" /> Save to PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
          <Bookmark className="h-4 w-4" /> Saved items
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          const el = document.getElementById('activity-section');
          el?.scrollIntoView({ behavior: 'smooth' });
        }} className="gap-2 cursor-pointer">
          <Activity className="h-4 w-4" /> Activity
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer">
          <Info className="h-4 w-4" /> About this profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Add Section Dropdown — LinkedIn-style with Core / Recommended / Additional accordions
const AddSectionDropdown: React.FC<{ userId: string; profile: any; setEditOpen: (v: boolean) => void; setEditForm: (v: any) => void }> = ({ userId, profile, setEditOpen, setEditForm }) => {
  const [open, setOpen] = useState(false);
  const [coreOpen, setCoreOpen] = useState(true);
  const [recommendedOpen, setRecommendedOpen] = useState(false);
  const [additionalOpen, setAdditionalOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full">Add profile section</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add to profile</DialogTitle></DialogHeader>

        {/* Core */}
        <Collapsible open={coreOpen} onOpenChange={setCoreOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b">
            <span className="font-semibold text-sm">Core</span>
            {coreOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0">
            <p className="text-xs text-muted-foreground py-2">Start with the basics. Filling out these sections will help you be discovered by recruiters and people you may know</p>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded" onClick={() => {
              setOpen(false);
              setEditForm({ full_name: profile.full_name || '', headline: profile.headline || '', summary: profile.summary || '', location: profile.location || '', website: profile.website || '', industry: profile.industry || '' });
              setEditOpen(true);
            }}>Add about</button>
            <AddEducationInline userId={userId} onClose={() => setOpen(false)} />
            <AddExperienceInline userId={userId} onClose={() => setOpen(false)} />
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add services</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add career break</button>
            <AddSkillInline userId={userId} onClose={() => setOpen(false)} />
          </CollapsibleContent>
        </Collapsible>

        {/* Recommended */}
        <Collapsible open={recommendedOpen} onOpenChange={setRecommendedOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b">
            <span className="font-semibold text-sm">Recommended</span>
            {recommendedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0">
            <p className="text-xs text-muted-foreground py-2">Completing these sections will increase your credibility and give you access to more opportunities</p>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add featured</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add licenses & certifications</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add projects</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add courses</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add recommendations</button>
          </CollapsibleContent>
        </Collapsible>

        {/* Additional */}
        <Collapsible open={additionalOpen} onOpenChange={setAdditionalOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b">
            <span className="font-semibold text-sm">Additional</span>
            {additionalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0">
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add volunteer experience</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add publications</button>
            <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded opacity-50 cursor-not-allowed">Add languages</button>
          </CollapsibleContent>
        </Collapsible>
      </DialogContent>
    </Dialog>
  );
};

// Experience item with edit/delete
const ExperienceItem: React.FC<{ exp: any; isOwn: boolean; userId: string }> = ({ exp, isOwn, userId }) => {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ title: exp.title, company: exp.company, location: exp.location || '', start_date: exp.start_date || '', end_date: exp.end_date || '', description: exp.description || '', is_current: exp.is_current || false });

  const update = async () => {
    await supabase.from('experiences').update(form).eq('id', exp.id);
    queryClient.invalidateQueries({ queryKey: ['experiences', userId] });
    setEditOpen(false);
    toast.success('Updated!');
  };

  const remove = async () => {
    await supabase.from('experiences').delete().eq('id', exp.id);
    queryClient.invalidateQueries({ queryKey: ['experiences', userId] });
    toast.success('Deleted!');
  };

  return (
    <div className="flex gap-3 group">
      <div className="h-12 w-12 rounded bg-secondary flex items-center justify-center flex-shrink-0">
        <Briefcase className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm">{exp.title}</p>
            <p className="text-sm">{exp.company} · {exp.location || 'Full-time'}</p>
            <p className="text-xs text-muted-foreground">{exp.start_date} – {exp.is_current ? 'Present' : exp.end_date}</p>
            {exp.description && <p className="text-sm mt-2 text-muted-foreground">{exp.description}</p>}
          </div>
          {isOwn && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Experience</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    <Input placeholder="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                    <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                      <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} disabled={form.is_current} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} /> Currently working here
                    </label>
                    <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <Button onClick={update} className="w-full">Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Education item with edit/delete
const EducationItem: React.FC<{ edu: any; isOwn: boolean; userId: string }> = ({ edu, isOwn, userId }) => {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ school: edu.school, degree: edu.degree || '', field_of_study: edu.field_of_study || '', start_date: edu.start_date || '', end_date: edu.end_date || '', description: edu.description || '' });

  const update = async () => {
    await supabase.from('education').update(form).eq('id', edu.id);
    queryClient.invalidateQueries({ queryKey: ['education', userId] });
    setEditOpen(false);
    toast.success('Updated!');
  };

  const remove = async () => {
    await supabase.from('education').delete().eq('id', edu.id);
    queryClient.invalidateQueries({ queryKey: ['education', userId] });
    toast.success('Deleted!');
  };

  return (
    <div className="flex gap-3 group">
      <div className="h-12 w-12 rounded bg-secondary flex items-center justify-center flex-shrink-0">
        <GraduationCap className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-sm">{edu.school}</p>
            <p className="text-sm text-muted-foreground">{edu.degree}{edu.field_of_study ? `, ${edu.field_of_study}` : ''}</p>
            <p className="text-xs text-muted-foreground">{edu.start_date} – {edu.end_date || 'Present'}</p>
            {edu.description && <p className="text-sm mt-2 text-muted-foreground">{edu.description}</p>}
          </div>
          {isOwn && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Education</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="School" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))} />
                    <Input placeholder="Degree" value={form.degree} onChange={e => setForm(f => ({ ...f, degree: e.target.value }))} />
                    <Input placeholder="Field of study" value={form.field_of_study} onChange={e => setForm(f => ({ ...f, field_of_study: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                      <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                    <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <Button onClick={update} className="w-full">Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Skill item with delete
const SkillItem: React.FC<{ skill: any; isOwn: boolean; userId: string }> = ({ skill, isOwn, userId }) => {
  const queryClient = useQueryClient();

  const remove = async () => {
    await supabase.from('skills').delete().eq('id', skill.id);
    queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    toast.success('Skill removed!');
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 group">
      <span className="text-sm font-medium">{skill.name}</span>
      {isOwn && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

// Sub-components for adding
const AddExperience: React.FC<{ userId: string }> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', start_date: '', end_date: '', description: '', is_current: false });

  const add = async () => {
    if (!form.title || !form.company) return;
    const insertData: any = { title: form.title, company: form.company, user_id: userId };
    if (form.location) insertData.location = form.location;
    if (form.start_date) insertData.start_date = form.start_date;
    if (form.end_date && !form.is_current) insertData.end_date = form.end_date;
    if (form.description) insertData.description = form.description;
    insertData.is_current = form.is_current;
    const { error } = await supabase.from('experiences').insert(insertData);
    if (error) { toast.error('Failed to add: ' + error.message); return; }
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
            <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} /> Currently working here
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
    if (!form.school) return;
    const insertData: any = { school: form.school, user_id: userId };
    if (form.degree) insertData.degree = form.degree;
    if (form.field_of_study) insertData.field_of_study = form.field_of_study;
    if (form.start_date) insertData.start_date = form.start_date;
    if (form.end_date) insertData.end_date = form.end_date;
    const { error } = await supabase.from('education').insert(insertData);
    if (error) { toast.error('Failed to add: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['education', userId] });
    setOpen(false);
    setForm({ school: '', degree: '', field_of_study: '', start_date: '', end_date: '' });
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

// Inline add buttons for AddSectionDropdown
const AddExperienceInline: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', company: '', location: '', start_date: '', end_date: '', description: '', is_current: false });

  const add = async () => {
    if (!form.title || !form.company) return;
    const insertData: any = { title: form.title, company: form.company, user_id: userId };
    if (form.location) insertData.location = form.location;
    if (form.start_date) insertData.start_date = form.start_date;
    if (form.end_date && !form.is_current) insertData.end_date = form.end_date;
    if (form.description) insertData.description = form.description;
    insertData.is_current = form.is_current;
    const { error } = await supabase.from('experiences').insert(insertData);
    if (error) { toast.error('Failed to add: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['experiences', userId] });
    setOpen(false);
    onClose();
    setForm({ title: '', company: '', location: '', start_date: '', end_date: '', description: '', is_current: false });
    toast.success('Experience added!');
  };

  return (
    <>
      <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded" onClick={() => setOpen(true)}>
        Add position
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
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
              <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} /> Currently working here
            </label>
            <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <Button onClick={add} className="w-full" disabled={!form.title || !form.company}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const AddEducationInline: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ school: '', degree: '', field_of_study: '', start_date: '', end_date: '' });

  const add = async () => {
    await supabase.from('education').insert({ ...form, user_id: userId });
    queryClient.invalidateQueries({ queryKey: ['education', userId] });
    setOpen(false);
    onClose();
    toast.success('Education added!');
  };

  return (
    <>
      <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded" onClick={() => setOpen(true)}>
        Add education
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
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
    </>
  );
};

const AddSkillInline: React.FC<{ userId: string; onClose: () => void }> = ({ userId, onClose }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const add = async () => {
    await supabase.from('skills').insert({ name, user_id: userId });
    queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    setOpen(false);
    onClose();
    setName('');
    toast.success('Skill added!');
  };

  return (
    <>
      <button className="w-full text-left py-3 border-b text-sm hover:bg-secondary/50 px-2 rounded" onClick={() => setOpen(true)}>
        Add skills
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Skill</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Skill name" value={name} onChange={e => setName(e.target.value)} />
            <Button onClick={add} className="w-full" disabled={!name.trim()}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Profile;
