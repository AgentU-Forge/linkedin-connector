import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageCircle, Repeat2, Send, ThumbsUp, Search, MoreHorizontal, Bookmark, Link2, Code, UserMinus, Ban, Flag } from 'lucide-react';
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
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'insightful', emoji: '💡', label: 'Insightful' },
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
          await supabase.rpc('insert_unique_notification', {
            p_user_id: post.user_id, p_actor_id: user.id, p_type: 'reaction', p_post_id: post.id,
          });
        }
      } else {
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id, reaction_type: reactionType });
        if (post.user_id !== user.id) {
          await supabase.rpc('insert_unique_notification', {
            p_user_id: post.user_id, p_actor_id: user.id, p_type: 'reaction', p_post_id: post.id,
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
        await supabase.rpc('insert_unique_notification', {
          p_user_id: post.user_id, p_actor_id: user.id, p_type: 'comment', p_post_id: post.id,
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
      const { data: existing } = await (supabase.from('reposts') as any).select('id').eq('post_id', post.id).eq('reposted_by', user.id).maybeSingle();
      if (existing) {
        await (supabase.from('reposts') as any).delete().eq('id', existing.id);
        toast.success('Repost removed');
        return;
      }
      await (supabase.from('reposts') as any).insert({ post_id: post.id, reposted_by: user.id });
      if (post.user_id !== user.id) {
        await supabase.rpc('insert_unique_notification', {
          p_user_id: post.user_id, p_actor_id: user.id, p_type: 'repost', p_post_id: post.id,
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
      await supabase.rpc('insert_unique_notification', {
        p_user_id: receiverId, p_actor_id: user.id, p_type: 'message',
      });
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
    <Card className="transition-all hover:shadow-md">
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
            <Avatar className="transition-transform hover:scale-105">
              <AvatarImage src={author?.avatar_url || ''} />
              <AvatarFallback>{author?.full_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1">
            <Link to={`/profile/${post.user_id}`} className="font-semibold text-sm hover:underline">
              {author?.full_name || 'User'}
            </Link>
            <p className="text-xs text-muted-foreground">{author?.headline}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
          <PostOptionsMenu post={post} authorName={author?.full_name} />
        </div>

        {/* Content */}
        {post.article_title && <h3 className="text-lg font-bold mb-2">{post.article_title}</h3>}
        <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>
        {post.image_url && <img src={post.image_url} alt="" className="rounded-lg w-full max-h-96 object-cover mb-3" />}
        {post.video_url && (
          <video src={post.video_url} controls className="rounded-lg w-full max-h-96 mb-3" />
        )}

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
          <div
            className="relative"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            <div
              className={cn(
                'absolute bottom-full left-0 mb-2 bg-card border rounded-full shadow-xl px-2 py-1.5 flex items-center gap-0.5 transition-all duration-300 z-20',
                showReactions
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-75 translate-y-2 pointer-events-none'
              )}
            >
              {REACTIONS.map((reaction, idx) => (
                <button
                  key={reaction.type}
                  onClick={() => handleReaction(reaction.type)}
                  className={cn(
                    'group relative flex flex-col items-center transition-all duration-200 p-1.5 rounded-full',
                    'hover:scale-[1.6] hover:-translate-y-3',
                    reactionAnimating === reaction.type && 'animate-bounce'
                  )}
                  style={{
                    transitionDelay: showReactions ? `${idx * 40}ms` : '0ms',
                    opacity: showReactions ? 1 : 0,
                    transform: showReactions ? undefined : 'scale(0.5) translateY(10px)',
                  }}
                  title={reaction.label}
                >
                  <span className="text-[1.6rem] leading-none transition-transform duration-200 group-hover:animate-bounce">
                    {reaction.emoji}
                  </span>
                  <span className="absolute -top-7 bg-foreground text-background text-[10px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none">
                    {reaction.label}
                  </span>
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction(currentReaction?.type || 'like')}
              className={cn(
                'gap-1 transition-all',
                isLiked ? 'text-primary font-semibold' : ''
              )}
            >
              {currentReaction ? (
                <span className={cn('text-lg', reactionAnimating && 'animate-bounce')}>{currentReaction.emoji}</span>
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{currentReaction?.label || 'Like'}</span>
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Comment</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => repost.mutate()}>
            <Repeat2 className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Repost</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Send</span>
          </Button>
        </div>

        {/* Comments */}
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

        {/* Send dialog */}
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

const PostOptionsMenu: React.FC<{ post: any; authorName?: string }> = ({ post, authorName }) => {
  const { user } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => toast.success('Post saved!')} className="gap-2 cursor-pointer">
          <Bookmark className="h-4 w-4" /> Save
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/profile/${post.user_id}`); toast.success('Link copied!'); }} className="gap-2 cursor-pointer">
          <Link2 className="h-4 w-4" /> Copy link to post
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`<iframe src="${window.location.origin}/profile/${post.user_id}" width="500" height="400"></iframe>`); toast.success('Embed code copied!'); }} className="gap-2 cursor-pointer">
          <Code className="h-4 w-4" /> Embed this post
        </DropdownMenuItem>
        {user?.id !== post.user_id && (
          <>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <UserMinus className="h-4 w-4" /> Unfollow {authorName || 'user'}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer">
              <Ban className="h-4 w-4" /> Not interested
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
              <Flag className="h-4 w-4" /> Report post
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <div className="flex gap-2 animate-fade-in">
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
