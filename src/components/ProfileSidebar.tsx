import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';

const ProfileSidebar = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: connectionCount = 0 } = useQuery({
    queryKey: ['connection-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user!.id},receiver_id.eq.${user!.id}`);
      return count || 0;
    },
    enabled: !!user,
  });

  if (!profile) return null;

  return (
    <Card className="sticky top-20 overflow-hidden">
      <div className="h-16 bg-gradient-to-r from-primary/80 to-primary" />
      <CardContent className="p-4 -mt-8">
        <Link to={`/profile/${user?.id}`}>
          <Avatar className="h-16 w-16 border-2 border-card">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback>{profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={`/profile/${user?.id}`} className="block mt-2 font-semibold text-sm hover:underline">
          {profile.full_name || 'Your Name'}
        </Link>
        <p className="text-xs text-muted-foreground">{profile.headline || 'Add a headline'}</p>
        <div className="mt-3 pt-3 border-t">
          <Link to="/network" className="flex justify-between text-xs hover:bg-secondary p-1 rounded">
            <span className="text-muted-foreground">Connections</span>
            <span className="font-semibold text-primary">{connectionCount}</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSidebar;
