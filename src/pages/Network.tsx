import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserPlus, Check, X, MessageSquare } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Network = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-requests', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('connections')
        .select('*')
        .eq('receiver_id', user!.id)
        .eq('status', 'pending');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['connections', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('connections')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      return data || [];
    },
    enabled: !!user,
  });

  // Sent pending requests (to show "Pending" state on suggestion cards)
  const { data: sentPending = [] } = useQuery({
    queryKey: ['sent-pending', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('connections')
        .select('*')
        .eq('requester_id', user!.id)
        .eq('status', 'pending');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', user?.id],
    queryFn: async () => {
      const connectedIds = connections.map((c: any) =>
        c.requester_id === user!.id ? c.receiver_id : c.requester_id
      );
      const pendingIds = pendingRequests.map((r: any) => r.requester_id);
      const sentPendingIds = sentPending.map((r: any) => r.receiver_id);
      const excludeIds = [...connectedIds, ...pendingIds, ...sentPendingIds, user!.id];

      if (excludeIds.length <= 1) {
        const { data } = await supabase.from('profiles').select('*').neq('user_id', user!.id).limit(10);
        return data || [];
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .not('user_id', 'in', `(${excludeIds.join(',')})`)
        .limit(10);
      return data || [];
    },
    enabled: !!user && connections !== undefined,
  });

  const respondToRequest = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === 'ignored') {
        await supabase.from('connections').delete().eq('id', id);
      } else {
        await supabase.from('connections').update({ status }).eq('id', id);
      }
      if (status === 'accepted') {
        const conn = pendingRequests.find((r: any) => r.id === id);
        if (conn) {
          await supabase.rpc('insert_unique_notification', {
            p_user_id: conn.requester_id, p_actor_id: user!.id, p_type: 'connection_accepted',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      toast.success('Done!');
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending Invitations ({pendingRequests.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((req: any) => (
              <ConnectionRequestCard
                key={req.id}
                userId={req.requester_id}
                onAccept={() => respondToRequest.mutate({ id: req.id, status: 'accepted' })}
                onReject={() => respondToRequest.mutate({ id: req.id, status: 'ignored' })}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>People you may know</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suggestions.map((p: any) => (
              <SuggestionCard key={p.id} profile={p} />
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2">No suggestions right now.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your Connections ({connections.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {connections.map((conn: any) => {
            const otherId = conn.requester_id === user?.id ? conn.receiver_id : conn.requester_id;
            return <ConnectionCard key={conn.id} userId={otherId} />;
          })}
          {connections.length === 0 && <p className="text-sm text-muted-foreground">No connections yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

const ConnectionRequestCard: React.FC<{ userId: string; onAccept: () => void; onReject: () => void }> = ({ userId, onAccept, onReject }) => {
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      return data;
    },
  });

  if (!profile) return null;

  return (
    <div className="flex items-center justify-between">
      <Link to={`/profile/${userId}`} className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={profile.avatar_url || ''} />
          <AvatarFallback>{profile.full_name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">{profile.headline}</p>
        </div>
      </Link>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onReject}>Ignore</Button>
        <Button size="sm" onClick={onAccept}>Accept</Button>
      </div>
    </div>
  );
};

const ConnectionCard: React.FC<{ userId: string }> = ({ userId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      return data;
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await supabase.from('connections').delete()
        .or(`and(requester_id.eq.${user!.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user!.id})`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      queryClient.invalidateQueries({ queryKey: ['connection-count'] });
      setDisconnectOpen(false);
      toast.success('Connection removed');
    },
  });

  if (!profile) return null;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary">
      <Link to={`/profile/${userId}`} className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={profile.avatar_url || ''} />
          <AvatarFallback>{profile.full_name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">{profile.headline}</p>
        </div>
      </Link>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDisconnectOpen(true)}>
          Connected
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate('/messaging')}>
          <MessageSquare className="h-4 w-4 mr-1" /> Message
        </Button>
      </div>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Remove Connection</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to remove {profile.full_name} from your connections?</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => disconnect.mutate()}>Yes, Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SuggestionCard: React.FC<{ profile: any }> = ({ profile }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: existingConn } = useQuery({
    queryKey: ['connection-status', user?.id, profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('connections')
        .select('*')
        .or(`and(requester_id.eq.${user!.id},receiver_id.eq.${profile.user_id}),and(requester_id.eq.${profile.user_id},receiver_id.eq.${user!.id})`)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const connect = useMutation({
    mutationFn: async () => {
      if (existingConn?.status === 'pending' && existingConn.requester_id === user!.id) {
        // Cancel
        await supabase.from('connections').delete().eq('id', existingConn.id);
        toast.success('Request cancelled');
        return;
      }
      await supabase.from('connections').insert({
        requester_id: user!.id, receiver_id: profile.user_id,
      });
      await supabase.rpc('insert_unique_notification', {
        p_user_id: profile.user_id, p_actor_id: user!.id, p_type: 'connection_request',
      });
      toast.success('Request sent!');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['connection-status'] });
      queryClient.invalidateQueries({ queryKey: ['sent-pending'] });
    },
  });

  const isPending = existingConn?.status === 'pending' && existingConn?.requester_id === user?.id;

  return (
    <Card>
      <CardContent className="p-4 text-center">
        <Link to={`/profile/${profile.user_id}`}>
          <Avatar className="h-16 w-16 mx-auto">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback>{profile.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <p className="font-semibold text-sm mt-2">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">{profile.headline}</p>
        </Link>
        <Button
          size="sm"
          variant={isPending ? 'secondary' : 'outline'}
          className="mt-3 w-full"
          onClick={() => connect.mutate()}
        >
          {isPending ? (
            'Pending'
          ) : (
            <><UserPlus className="h-4 w-4 mr-1" /> Connect</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default Network;
