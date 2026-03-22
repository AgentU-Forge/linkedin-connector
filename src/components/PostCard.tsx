import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { MessageCircle, Repeat2, Send, ThumbsUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PostCardProps {
  post: any;
}

const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
  { type: 'feeling_good', emoji: '😊', label: 'Feel Good' },
  { type: 'clap', emoji: '👏', label: 'Clap' },
];

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionAnimating, setReactionAnimating] = useState<string | null>(null);

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

  const userLike = likes.find((l: any) => l.user_id === user?.id);
  const isLiked = !!userLike;

  // Group reactions by type for display
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
        await supabase.from('likes').update({ reaction_type: reactionType }).eq('user_id', user.id).eq('post_id', post.id);
      } else {
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id, reaction_type: reactionType });
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: post.user_id,
            actor_id: user.id,
            type: 'like',
            post_id: post.id,
          });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['likes', post.id] }),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !commentText.trim()) return;
      await supabase.from('comments').insert({
        user_id: user.id,
        post_id: post.id,
        content: commentText,
      });
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: 'comment',
          post_id: post.id,
        });
      }
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
    },
  });

  const handleReaction = (reactionType: string) => {
    setReactionAnimating(reactionType);
    setTimeout(() => setReactionAnimating(null), 600);
    toggleLike.mutate(reactionType);
    setShowReactions(false);
  };

  const currentReaction = REACTIONS.find(r => r.type === userLike?.reaction_type);

  // Get unique emojis for display
  const displayEmojis = Object.keys(reactionCounts)
    .map(type => REACTIONS.find(r => r.type === type)?.emoji)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Card>
      <CardContent className="p-4">
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
        {post.article_title && (
          <h3 className="text-lg font-bold mb-2">{post.article_title}</h3>
        )}
        <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>
        {post.image_url && (
          <img src={post.image_url} alt="" className="rounded-lg w-full max-h-96 object-cover mb-3" />
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
          {/* Like / Reaction button with hover popup */}
          <div
            className="relative"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            {/* Reaction picker popup */}
            <div
              className={cn(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border rounded-full shadow-xl px-2 py-1.5 flex items-center gap-1 transition-all duration-300 z-10',
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
                    'group relative flex flex-col items-center transition-all duration-200 hover:scale-150 hover:-translate-y-2 p-1 rounded-full',
                    reactionAnimating === reaction.type && 'animate-scale-in'
                  )}
                  style={{ transitionDelay: `${idx * 40}ms` }}
                  title={reaction.label}
                >
                  <span className="text-2xl">{reaction.emoji}</span>
                  <span className="absolute -top-7 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {reaction.label}
                  </span>
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction(currentReaction?.type || 'like')}
              className={cn(isLiked ? 'text-primary' : '')}
            >
              {currentReaction ? (
                <span className={cn('text-lg mr-1', reactionAnimating && 'animate-scale-in')}>{currentReaction.emoji}</span>
              ) : (
                <ThumbsUp className="h-4 w-4 mr-1" />
              )}
              {currentReaction?.label || 'Like'}
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4 mr-1" /> Comment
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            navigator.clipboard.writeText(window.location.origin + '/post/' + post.id);
            toast.success('Link copied!');
          }}>
            <Repeat2 className="h-4 w-4 mr-1" /> Repost
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            navigator.clipboard.writeText(window.location.origin + '/post/' + post.id);
            toast.success('Post link copied to share!');
          }}>
            <Send className="h-4 w-4 mr-1" /> Send
          </Button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3 animate-fade-in">
            {comments.map((c: any) => (
              <CommentItem key={c.id} comment={c} />
            ))}
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
      </CardContent>
    </Card>
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
