import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import CreatePost from '@/components/CreatePost';
import PostCard from '@/components/PostCard';
import ProfileSidebar from '@/components/ProfileSidebar';

const Feed = () => {
  const { user } = useAuth();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <aside className="lg:col-span-3 hidden lg:block">
        <ProfileSidebar />
      </aside>
      <div className="lg:col-span-6 space-y-4">
        <CreatePost />
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading feed...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No posts yet. Be the first to share!</div>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} />)
        )}
      </div>
      <aside className="lg:col-span-3 hidden lg:block">
        <div className="sticky top-20 space-y-4">
          <div className="rounded-lg bg-card border p-4 text-sm text-muted-foreground">
           <p className="font-semibold text-foreground mb-2">PRO NET</p>
            <p>AI Assistant and Premium features coming soon.</p>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Feed;
