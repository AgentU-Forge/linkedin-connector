import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, ThumbsUp, MessageCircle, UserPlus, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const Notifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <ThumbsUp className="h-4 w-4 text-primary" />;
      case 'comment': return <MessageCircle className="h-4 w-4 text-linkedin-green" />;
      case 'connection_request': return <UserPlus className="h-4 w-4 text-linkedin-warm" />;
      case 'connection_accepted': return <CheckCheck className="h-4 w-4 text-linkedin-green" />;
      case 'message': return <MessageCircle className="h-4 w-4 text-primary" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getMessage = (type: string) => {
    switch (type) {
      case 'like': return 'liked your post';
      case 'comment': return 'commented on your post';
      case 'connection_request': return 'sent you a connection request';
      case 'connection_accepted': return 'accepted your connection request';
      case 'message': return 'sent you a message';
      default: return 'interacted with you';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Notifications</CardTitle>
          {notifications.some((n: any) => !n.is_read) && (
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
              Mark all as read
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-1">
          {notifications.map((n: any) => (
            <NotificationItem key={n.id} notification={n} icon={getIcon(n.type)} message={getMessage(n.type)} />
          ))}
          {notifications.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No notifications yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const NotificationItem: React.FC<{ notification: any; icon: React.ReactNode; message: string }> = ({ notification, icon, message }) => {
  const { data: actor } = useQuery({
    queryKey: ['profile', notification.actor_id],
    queryFn: async () => {
      if (!notification.actor_id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', notification.actor_id).single();
      return data;
    },
    enabled: !!notification.actor_id,
  });

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${notification.is_read ? '' : 'bg-primary/5'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={actor?.avatar_url || ''} />
        <AvatarFallback>{actor?.full_name?.charAt(0) || '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <Link to={`/profile/${notification.actor_id}`} className="font-semibold hover:underline">
            {actor?.full_name || 'Someone'}
          </Link>{' '}
          {message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};

export default Notifications;
