import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const AdminLogin = () => {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, check if admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('has_role', { _user_id: user!.id, _role: 'admin' });
      return data;
    },
    enabled: !!user,
  });

  if (user && isAdmin) return <Navigate to="/admin" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // After sign in, check admin role
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        const { data: hasAdmin } = await supabase.rpc('has_role', {
          _user_id: session.session.user.id, _role: 'admin'
        });
        if (hasAdmin) {
          navigate('/admin');
          toast.success('Welcome, Admin!');
        } else {
          toast.error('You are not an admin.');
          await supabase.auth.signOut();
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm animate-scale-in">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-destructive">
            <Shield className="h-6 w-6 text-destructive-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your admin credentials</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Sign In as Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
