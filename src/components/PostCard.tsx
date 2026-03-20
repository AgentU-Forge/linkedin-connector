import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ThumbsUp, MessageCircle, Share2, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: any;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

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

  const isLiked = likes.some((l: any) => l.user_id === user?.id);

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (isLiked) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', post.id);
      } else {
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
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

  return (
    <Card>
      <CardContent className="p-4">
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

        {post.article_title && (
          <h3 className="text-lg font-bold mb-2">{post.article_title}</h3>
        )}
        <p className="text-sm whitespace-pre-wrap mb-3">{post.content}</p>

        {post.image_url && (
          <img src={post.image_url} alt="" className="rounded-lg w-full max-h-96 object-cover mb-3" />
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-b">
          <span>{likes.length} likes</span>
          <button onClick={() => setShowComments(!showComments)} className="hover:underline">
            {comments.length} comments
          </button>
        </div>

        <div className="flex items-center justify-around pt-1">
          <Button variant="ghost" size="sm" onClick={() => toggleLike.mutate()}
            className={isLiked ? 'text-primary' : ''}>
            <ThumbsUp className="h-4 w-4 mr-1" /> Like
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4 mr-1" /> Comment
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            navigator.clipboard.writeText(window.location.origin + '/post/' + post.id);
            toast.success('Link copied!');
          }}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>

        {showComments && (
          <div className="mt-3 space-y-3">
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
