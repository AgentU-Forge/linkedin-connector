import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Messaging = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get connected users
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

  const connectedUserIds = connections.map((c: any) =>
    c.requester_id === user?.id ? c.receiver_id : c.requester_id
  );

  // Fetch initial messages when user is selected
  useEffect(() => {
    if (!selectedUser || !user) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser}),and(sender_id.eq.${selectedUser},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      setMessages(data || []);

      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', selectedUser)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    };
    fetchMessages();
  }, [selectedUser, user]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as any;
        // Only add if relevant to current conversation
        if (
          (msg.sender_id === user.id && msg.receiver_id === selectedUser) ||
          (msg.sender_id === selectedUser && msg.receiver_id === user.id)
        ) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Mark as read if from other user
          if (msg.sender_id === selectedUser) {
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedUser || !user) return;
    const content = messageText;
    setMessageText('');
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser,
      content,
    });
    // Use unique notification
    await supabase.rpc('insert_unique_notification', {
      p_user_id: selectedUser,
      p_actor_id: user.id,
      p_type: 'message',
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="h-[calc(100vh-8rem)] flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r flex flex-col">
          <div className="p-3 border-b font-semibold">Messaging</div>
          <div className="flex-1 overflow-y-auto">
            {connectedUserIds.map((uid: string) => (
              <ConversationItem
                key={uid}
                userId={uid}
                isSelected={selectedUser === uid}
                onClick={() => setSelectedUser(uid)}
              />
            ))}
            {connectedUserIds.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Connect with people to start messaging.</p>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {selectedUser ? (
            <>
              <ChatHeader userId={selectedUser} />
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 text-sm transition-all ${
                      msg.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    }`}>
                      <p>{msg.content}</p>
                      <p className="text-[10px] mt-1 opacity-70">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Write a message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <Button size="icon" onClick={sendMessage} disabled={!messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const ConversationItem: React.FC<{ userId: string; isSelected: boolean; onClick: () => void }> = ({ userId, isSelected, onClick }) => {
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      return data;
    },
  });

  if (!profile) return null;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-secondary transition-colors ${isSelected ? 'bg-secondary' : ''}`}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={profile.avatar_url || ''} />
        <AvatarFallback>{profile.full_name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
      </div>
    </button>
  );
};

const ChatHeader: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
      return data;
    },
  });

  return (
    <div className="p-3 border-b flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={profile?.avatar_url || ''} />
        <AvatarFallback>{profile?.full_name?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-semibold">{profile?.full_name}</p>
        <p className="text-xs text-muted-foreground">{profile?.headline}</p>
      </div>
    </div>
  );
};

export default Messaging;
