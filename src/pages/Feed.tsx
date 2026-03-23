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

  // Fetch reposts
  const { data: reposts = [] } = useQuery({
    queryKey: ['reposts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reposts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Merge posts and reposts into a single feed, sorted by time
  const feedItems = React.useMemo(() => {
    const items: { type: 'post' | 'repost'; data: any; sortDate: string }[] = [];
    
    posts.forEach(p => {
      items.push({ type: 'post', data: p, sortDate: p.created_at });
    });

    reposts.forEach((r: any) => {
      const originalPost = posts.find(p => p.id === r.post_id);
      if (originalPost) {
        items.push({ type: 'repost', data: { ...originalPost, repost: r }, sortDate: r.created_at });
      }
    });

    // Sort by date descending
    items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

    // Deduplicate - keep first occurrence of each post
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.type === 'repost' ? `repost-${item.data.repost.id}` : `post-${item.data.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [posts, reposts]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <aside className="lg:col-span-3 hidden lg:block">
        <ProfileSidebar />
      </aside>
      <div className="lg:col-span-6 space-y-4">
        <CreatePost />
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading feed...</div>
        ) : feedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No posts yet. Be the first to share!</div>
        ) : (
          feedItems.map((item, i) => (
            <PostCard
              key={item.type === 'repost' ? `repost-${item.data.repost.id}` : `post-${item.data.id}`}
              post={item.data}
              isRepost={item.type === 'repost'}
              repostedBy={item.type === 'repost' ? item.data.repost.reposted_by : undefined}
            />
          ))
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
