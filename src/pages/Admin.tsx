import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Users, FileText, Briefcase, Trash2, Ban, Search, BarChart3, MessageCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Navigate } from 'react-router-dom';

const Admin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Check if current user is admin
  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('has_role', { _user_id: user!.id, _role: 'admin' });
      return data;
    },
    enabled: !!user,
  });

  // All profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!isAdmin,
  });

  // All posts
  const { data: posts = [] } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: async () => {
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!isAdmin,
  });

  // All jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data } = await (supabase.from('jobs') as any).select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!isAdmin,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [{ count: userCount }, { count: postCount }, { count: jobCount }, { count: connCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        (supabase.from('jobs') as any).select('*', { count: 'exact', head: true }),
        supabase.from('connections').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
      ]);
      return { users: userCount || 0, posts: postCount || 0, jobs: jobCount || 0, connections: connCount || 0 };
    },
    enabled: !!isAdmin,
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      await supabase.from('comments').delete().eq('post_id', postId);
      await supabase.from('likes').delete().eq('post_id', postId);
      await supabase.from('posts').delete().eq('id', postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Post deleted');
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      await (supabase.from('jobs') as any).delete().eq('id', jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast.success('Job deleted');
    },
  });

  if (checkingAdmin) return <div className="text-center py-8 text-muted-foreground animate-pulse">Checking access...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filteredProfiles = profiles.filter((p: any) =>
    !searchQuery || p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.headline?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage users, posts, and platform activity</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Users', value: stats?.users || 0, icon: Users, color: 'text-primary' },
          { label: 'Posts', value: stats?.posts || 0, icon: FileText, color: 'text-linkedin-green' },
          { label: 'Jobs', value: stats?.jobs || 0, icon: Briefcase, color: 'text-linkedin-warm' },
          { label: 'Connections', value: stats?.connections || 0, icon: MessageCircle, color: 'text-destructive' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Headline</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={p.avatar_url || ''} />
                          <AvatarFallback className="text-xs">{p.full_name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{p.full_name || 'No name'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.headline || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.location || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {p.user_id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(p.user_id)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-xs truncate text-sm">{p.content?.slice(0, 80)}</TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="secondary">{p.post_type}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deletePost.mutate(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead className="hidden md:table-cell">Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-sm font-medium">{j.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{j.company}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{j.location}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteJob.mutate(j.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm ban dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ban User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will delete all content by this user. Are you sure?</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmDelete) return;
              // Delete user content
              await supabase.from('posts').delete().eq('user_id', confirmDelete);
              await supabase.from('comments').delete().eq('user_id', confirmDelete);
              await supabase.from('likes').delete().eq('user_id', confirmDelete);
              await supabase.from('connections').delete().or(`requester_id.eq.${confirmDelete},receiver_id.eq.${confirmDelete}`);
              await supabase.from('profiles').delete().eq('user_id', confirmDelete);
              queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
              queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
              setConfirmDelete(null);
              toast.success('User banned and content removed');
            }}>
              Yes, Ban User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
