import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageCircle, Repeat2, Send, ThumbsUp, Search, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: any;
  isRepost?: boolean;
  repostedBy?: string;
}

const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { type: 'insightful', emoji: '💡', label: 'Insightful' },
  { type: 'feeling_good', emoji: '😊', label: 'Feel Good' },
  { type: 'clap', emoji: '👏', label: 'Clap' },
  { type: 'curious', emoji: '🤔', label: 'Curious' },
];

const PostCard: React.FC<PostCardProps> = ({ post, isRepost, repostedBy }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionAnimating, setReactionAnimating] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendSearch, setSendSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { data: repostedByProfile } = useQuery({
    queryKey: ['profile', repostedBy],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', repostedBy!).single();
      return data;
    },
    enabled: !!repostedBy,
  });

  const { data: author } = useQuery({
    queryKey: ['profile', post.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', post.user_id).single();
      return data;
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ['likes', post.id],
    queryFn: async () => {
      const { data } = await supabase.from('likes').select('*').eq('post_id', post.id);
      return data || [];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: async () => {
      const { data } = await supabase.from('comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true });
      return data || [];
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['connections', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('connections').select('*').eq('status', 'accepted').or(`requester_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      return data || [];
    },
    enabled: !!user,
  });

  const userLike = likes.find((l: any) => l.user_id === user?.id);
  const isLiked = !!userLike;

  const reactionCounts: Record<string, number> = {};
  likes.forEach((l: any) => {
    const t = l.reaction_type || 'like';
    reactionCounts[t] = (reactionCounts[t] || 0) + 1;
  });

  const toggleLike = useMutation({
    mutationFn: async (reactionType: string = 'like') => {
      if (!user) return;
      if (isLiked && userLike.reaction_type === reactionType) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', post.id);
      } else if (isLiked) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', post.id);
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id, reaction_type: reactionType });
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: post.user_id, actor_id: user.id, type: 'reaction', post_id: post.id,
          });
        }
      } else {
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id, reaction_type: reactionType });
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: post.user_id, actor_id: user.id, type: 'reaction', post_id: post.id,
          });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['likes', post.id] }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !commentText.trim()) return;
      await supabase.from('comments').insert({ user_id: user.id, post_id: post.id, content: commentText });
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, actor_id: user.id, type: 'comment', post_id: post.id,
        });
      }
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    },
  });

  const repost = useMutation({
    mutationFn: async () => {
      if (!user) return;
      // Check if already reposted
      const { data: existing } = await supabase.from('reposts').select('id').eq('post_id', post.id).eq('reposted_by', user.id).maybeSingle();
      if (existing) {
        await supabase.from('reposts').delete().eq('id', existing.id);
        toast.success('Repost removed');
        return;
      }
      await supabase.from('reposts').insert({ post_id: post.id, reposted_by: user.id });
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, actor_id: user.id, type: 'repost', post_id: post.id,
        });
      }
      toast.success('Reposted!');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['reposts'] });
    },
  });

  const handleReaction = (reactionType: string) => {
    setReactionAnimating(reactionType);
    setTimeout(() => setReactionAnimating(null), 600);
    toggleLike.mutate(reactionType);
    setShowReactions(false);
  };

  const handleSendToConnections = async () => {
    if (!user || selectedUsers.length === 0) return;
    const postLink = `${window.location.origin}/profile/${post.user_id}`;
    const message = `📌 Shared a post by ${author?.full_name || 'someone'}:\n\n"${post.content?.slice(0, 100)}${post.content?.length > 100 ? '...' : ''}"\n\n${postLink}`;
    
    for (const receiverId of selectedUsers) {
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: receiverId, content: message });
      await supabase.from('notifications').insert({ user_id: receiverId, actor_id: user.id, type: 'message' });
    }
    toast.success(`Sent to ${selectedUsers.length} connection(s)!`);
    setSelectedUsers([]);
    setSendSearch('');
    setSendOpen(false);
  };

  const currentReaction = REACTIONS.find(r => r.type === userLike?.reaction_type);

  const displayEmojis = Object.keys(reactionCounts)
    .map(type => REACTIONS.find(r => r.type === type)?.emoji)
    .filter(Boolean)
    .slice(0, 3);

  const connectedUserIds = connections.map((c: any) =>
    c.requester_id === user?.id ? c.receiver_id : c.requester_id
  );

  return (
    <Card>
      <CardContent className="p-4">
        {/* Repost label */}
        {isRepost && repostedByProfile && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 pb-2 border-b">
            <Repeat2 className="h-3.5 w-3.5" />
            <Link to={`/profile/${repostedBy}`} className="font-semibold hover:underline">
              {repostedByProfile.full_name}
            </Link>
            reposted this
          </div>
        )}

        {/* Author header */}
        <div className="flex gap-3 mb-3">
          <Link to={`/profile/${post.user_id}`}>
            <Avatar>
              <AvatarImage src={author?.avatar_url || ''} />
              <AvatarFallback>{author?.full_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link to={`/profile/${post.user_id}`} className="font-semibold text-sm hover:underline">
              {author?.full_name || 'User'}
            </Link>
            <p className="text-xs text-muted-foreground">{author?.headline}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {/* Content */}
        {post.article_title && <h3 className="text-lg font-bold mb-2">{post.article_title}</h3>}
        <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>
        {post.image_url && <img src={post.image_url} alt="" className="rounded-lg w-full max-h-96 object-cover mb-3" />}

        {/* Reaction summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-b">
          <div className="flex items-center gap-1">
            {displayEmojis.length > 0 && (
              <span className="flex -space-x-0.5">{displayEmojis.map((e, i) => <span key={i}>{e}</span>)}</span>
            )}
            <span>{likes.length > 0 ? likes.length : ''}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowComments(!showComments)} className="hover:underline">
              {comments.length} comments
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-around pt-1 relative">
          {/* Reaction button with neon hover popup */}
          <div
            className="relative"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            <div
              className={cn(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border rounded-full shadow-2xl px-3 py-2 flex items-center gap-1.5 transition-all duration-300 z-20',
                showReactions
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-50 translate-y-3 pointer-events-none'
              )}
              style={{ filter: showReactions ? 'drop-shadow(0 0 8px hsl(var(--primary) / 0.4))' : 'none' }}
            >
              {REACTIONS.map((reaction, idx) => (
                <button
                  key={reaction.type}
                  onClick={() => handleReaction(reaction.type)}
                  className={cn(
                    'group relative flex flex-col items-center transition-all duration-200 p-1 rounded-full',
                    'hover:scale-[1.8] hover:-translate-y-3',
                    reactionAnimating === reaction.type && 'animate-bounce'
                  )}
                  style={{
                    transitionDelay: showReactions ? `${idx * 50}ms` : '0ms',
                    transform: showReactions ? undefined : 'scale(0)',
                    animation: showReactions ? `neon-pop 0.3s ease-out ${idx * 50}ms both` : 'none',
                  }}
                  title={reaction.label}
                >
                  <span className="text-2xl drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 6px rgba(255,200,50,0.5))' }}>
                    {reaction.emoji}
                  </span>
                  <span className="absolute -top-8 bg-foreground text-background text-[10px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                    {reaction.label}
                  </span>
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction(currentReaction?.type || 'like')}
              className={cn(isLiked ? 'text-primary font-semibold' : '')}
            >
              {currentReaction ? (
                <span className={cn('text-lg mr-1', reactionAnimating && 'animate-bounce')}>{currentReaction.emoji}</span>
              ) : (
                <ThumbsUp className="h-4 w-4 mr-1" />
              )}
              {currentReaction?.label || 'Like'}
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4 mr-1" /> Comment
          </Button>
          <Button variant="ghost" size="sm" onClick={() => repost.mutate()}>
            <Repeat2 className="h-4 w-4 mr-1" /> Repost
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> Send
          </Button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3 animate-fade-in">
            {comments.map((c: any) => <CommentItem key={c.id} comment={c} />)}
            <div className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment.mutate()}
                className="text-sm"
              />
              <Button size="icon" variant="ghost" onClick={() => addComment.mutate()} disabled={!commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Send to connections dialog */}
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Send to connections</DialogTitle></DialogHeader>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search connections..." value={sendSearch} onChange={e => setSendSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {connectedUserIds.map((uid: string) => (
                <SendConnectionItem
                  key={uid}
                  userId={uid}
                  search={sendSearch}
                  selected={selectedUsers.includes(uid)}
                  onToggle={() => setSelectedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])}
                />
              ))}
              {connectedUserIds.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No connections yet.</p>}
            </div>
            <Button onClick={handleSendToConnections} disabled={selectedUsers.length === 0} className="w-full mt-2">
              Send to {selectedUsers.length > 0 ? `${selectedUsers.length} connection(s)` : 'selected'}
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const SendConnectionItem: React.FC<{ userId: string; search: string; selected: boolean; onToggle: () => void }> = ({ userId, search, selected, onToggle }) => {
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      return data;
    },
  });

  if (!profile) return null;
  if (search && !profile.full_name?.toLowerCase().includes(search.toLowerCase())) return null;

  return (
    <button onClick={onToggle} className={cn('w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors', selected && 'bg-primary/10')}>
      <Checkbox checked={selected} />
      <Avatar className="h-8 w-8">
        <AvatarImage src={profile.avatar_url || ''} />
        <AvatarFallback className="text-xs">{profile.full_name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="text-left">
        <p className="text-sm font-semibold">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground">{profile.headline}</p>
      </div>
    </button>
  );
};

const CommentItem: React.FC<{ comment: any }> = ({ comment }) => {
  const { data: author } = useQuery({
    queryKey: ['profile', comment.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', comment.user_id).single();
      return data;
    },
  });

  return (
    <div className="flex gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={author?.avatar_url || ''} />
        <AvatarFallback className="text-xs">{author?.full_name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="bg-secondary rounded-lg p-2 flex-1">
        <Link to={`/profile/${comment.user_id}`} className="text-xs font-semibold hover:underline">
          {author?.full_name || 'User'}
        </Link>
        <p className="text-sm">{comment.content}</p>
      </div>
    </div>
  );
};

export default PostCard;
