import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, ThumbsUp, MessageCircle, UserPlus, CheckCheck, Repeat2, Briefcase, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

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

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['unread-count', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const respondToRequest = useMutation({
    mutationFn: async ({ actorId, action }: { actorId: string; action: 'accepted' | 'ignored' }) => {
      // Find the connection request
      const { data: conn } = await supabase
        .from('connections')
        .select('*')
        .eq('requester_id', actorId)
        .eq('receiver_id', user!.id)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (!conn) return;
      
      if (action === 'accepted') {
        await supabase.from('connections').update({ status: 'accepted' }).eq('id', conn.id);
        await supabase.rpc('insert_unique_notification', {
          p_user_id: actorId, p_actor_id: user!.id, p_type: 'connection_accepted',
        });
        toast.success('Connection accepted!');
      } else {
        await supabase.from('connections').delete().eq('id', conn.id);
        toast.success('Request ignored');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': case 'reaction': return <Heart className="h-4 w-4 text-destructive" />;
      case 'comment': return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'connection_request': return <UserPlus className="h-4 w-4 text-primary" />;
      case 'connection_accepted': return <CheckCheck className="h-4 w-4 text-primary" />;
      case 'message': return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'repost': return <Repeat2 className="h-4 w-4 text-primary" />;
      case 'job_application': return <Briefcase className="h-4 w-4 text-primary" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getMessage = (type: string) => {
    switch (type) {
      case 'like': return 'liked your post';
      case 'reaction': return 'reacted to your post';
      case 'comment': return 'commented on your post';
      case 'connection_request': return 'sent you a connection request';
      case 'connection_accepted': return 'accepted your connection request';
      case 'message': return 'sent you a message';
      case 'repost': return 'reposted your post';
      case 'job_application': return 'applied to your job posting';
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
            <NotificationItem
              key={n.id}
              notification={n}
              icon={getIcon(n.type)}
              message={getMessage(n.type)}
              onAccept={n.type === 'connection_request' ? () => respondToRequest.mutate({ actorId: n.actor_id, action: 'accepted' }) : undefined}
              onIgnore={n.type === 'connection_request' ? () => respondToRequest.mutate({ actorId: n.actor_id, action: 'ignored' }) : undefined}
            />
          ))}
          {notifications.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No notifications yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const NotificationItem: React.FC<{
  notification: any;
  icon: React.ReactNode;
  message: string;
  onAccept?: () => void;
  onIgnore?: () => void;
}> = ({ notification, icon, message, onAccept, onIgnore }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: actor } = useQuery({
    queryKey: ['profile', notification.actor_id],
    queryFn: async () => {
      if (!notification.actor_id) return null;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', notification.actor_id).single();
      return data;
    },
    enabled: !!notification.actor_id,
  });

  // Check if connection request is still pending
  const { data: pendingConn } = useQuery({
    queryKey: ['conn-pending', notification.actor_id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('connections')
        .select('id, status')
        .eq('requester_id', notification.actor_id)
        .eq('receiver_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: notification.type === 'connection_request' && !!notification.actor_id && !!user,
  });

  const showActions = notification.type === 'connection_request' && pendingConn?.status === 'pending';

  const markRead = async () => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${notification.is_read ? 'hover:bg-secondary/50' : 'bg-primary/5 hover:bg-primary/10'}`}
      onClick={markRead}
    >
      <div className="flex-shrink-0 mt-1">{icon}</div>
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
        {showActions && (
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={e => { e.stopPropagation(); onAccept?.(); }}>Accept</Button>
            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onIgnore?.(); }}>Ignore</Button>
          </div>
        )}
      </div>
      {!notification.is_read && (
        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
      )}
    </div>
  );
};

export default Notifications;
