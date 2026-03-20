import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
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

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', user?.id],
    queryFn: async () => {
      const connectedIds = connections.map((c: any) =>
        c.requester_id === user!.id ? c.receiver_id : c.requester_id
      );
      const pendingIds = pendingRequests.map((r: any) => r.requester_id);
      const excludeIds = [...connectedIds, ...pendingIds, user!.id];

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
      await supabase.from('connections').update({ status }).eq('id', id);
      if (status === 'accepted') {
        const conn = pendingRequests.find((r: any) => r.id === id);
        if (conn) {
          await supabase.from('notifications').insert({
            user_id: conn.requester_id,
            actor_id: user!.id,
            type: 'connection_accepted',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
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
                onReject={() => respondToRequest.mutate({ id: req.id, status: 'rejected' })}
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
        <Button size="icon" variant="ghost" onClick={onReject}><X className="h-4 w-4" /></Button>
        <Button size="icon" onClick={onAccept}><Check className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

const ConnectionCard: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      return data;
    },
  });

  if (!profile) return null;

  return (
    <Link to={`/profile/${userId}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary">
      <Avatar>
        <AvatarImage src={profile.avatar_url || ''} />
        <AvatarFallback>{profile.full_name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-semibold text-sm">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground">{profile.headline}</p>
      </div>
    </Link>
  );
};

const SuggestionCard: React.FC<{ profile: any }> = ({ profile }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: async () => {
      await supabase.from('connections').insert({
        requester_id: user!.id,
        receiver_id: profile.user_id,
      });
      await supabase.from('notifications').insert({
        user_id: profile.user_id,
        actor_id: user!.id,
        type: 'connection_request',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Request sent!');
    },
  });

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
        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => connect.mutate()}>
          <UserPlus className="h-4 w-4 mr-1" /> Connect
        </Button>
      </CardContent>
    </Card>
  );
};

export default Network;
