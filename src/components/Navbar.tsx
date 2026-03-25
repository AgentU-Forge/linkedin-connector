import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Users, MessageSquare, Bell, Briefcase, Search, LogOut, User, BotMessageSquare, CreditCard, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('has_role', { _user_id: user!.id, _role: 'admin' });
      return data;
    },
    enabled: !!user,
  });

  // Search results
  const { data: searchResults = [] } = useQuery({
    queryKey: ['search-users', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${searchQuery}%`)
        .neq('user_id', user!.id)
        .limit(10);
      return data || [];
    },
    enabled: !!user && searchQuery.trim().length > 0,
  });

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/network', icon: Users, label: 'My Network' },
    { to: '/jobs', icon: Briefcase, label: 'Jobs' },
    { to: '/messaging', icon: MessageSquare, label: 'Messaging' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSearchSelect = (userId: string) => {
    setSearchQuery('');
    setSearchOpen(false);
    navigate(`/profile/${userId}`);
  };

  return (
    <nav className="sticky top-0 z-50 bg-card border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground hidden sm:inline tracking-tight">PRO NET</span>
          </Link>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              className="pl-9 w-56 h-9 bg-secondary"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => searchQuery.trim() && setSearchOpen(true)}
            />
            {/* Search results dropdown */}
            {searchOpen && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-xl max-h-80 overflow-y-auto z-50 animate-fade-in">
                {searchResults.length > 0 ? (
                  searchResults.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => handleSearchSelect(p.user_id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={p.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{p.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.headline}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-muted-foreground text-center">No results found</p>
                )}
              </div>
            )}
          </div>
          {/* Mobile search button */}
          <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9" onClick={() => setSearchOpen(!searchOpen)}>
            <Search className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center px-2 sm:px-3 py-1 text-xs transition-colors ${
                isActive(item.to)
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="hidden md:inline mt-0.5">{item.label}</span>
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center px-2 sm:px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="text-[10px]">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline mt-0.5">Me ▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to={`/profile/${user?.id}`} className="flex items-center gap-2">
                  <User className="h-4 w-4" /> View Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ai-assistant" className="flex items-center gap-2">
                  <BotMessageSquare className="h-4 w-4" /> AI Assistant
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/premium" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Premium
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center gap-2 text-destructive">
                    <Shield className="h-4 w-4" /> Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 text-destructive">
                <LogOut className="h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="sm:hidden px-4 pb-3 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9 pr-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {searchQuery.trim() && (
            <div className="mt-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleSearchSelect(p.user_id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.avatar_url || ''} />
                      <AvatarFallback className="text-xs">{p.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.headline}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="p-3 text-sm text-muted-foreground text-center">No results found</p>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
