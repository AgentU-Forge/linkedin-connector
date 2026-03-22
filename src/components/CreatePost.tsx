import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Image, FileText, X, Smile, CalendarDays, Gift, MoreHorizontal, Clock, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

const CreatePost = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isArticle, setIsArticle] = useState(false);
  const [articleTitle, setArticleTitle] = useState('');
  const [posting, setPosting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePost = async () => {
    if (!content.trim() || !user) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadFile('post-images', user.id, imageFile);
      }
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content,
        image_url: imageUrl,
        post_type: isArticle ? 'article' : 'post',
        article_title: isArticle ? articleTitle : null,
      });
      if (error) throw error;
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setIsArticle(false);
      setArticleTitle('');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post published!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  const resetAndClose = () => {
    setDialogOpen(false);
  };

  return (
    <>
      {/* Trigger Card */}
      <Card className="cursor-pointer" onClick={() => setDialogOpen(true)}>
        <CardContent className="p-4">
          <div className="flex gap-3 items-center">
            <Avatar>
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div
              className="flex-1 rounded-full border border-input px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              What do you want to talk about?
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 ml-12">
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={e => { e.stopPropagation(); setDialogOpen(true); }}>
              <Image className="h-5 w-5 text-primary" /> Photo
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={e => { e.stopPropagation(); setIsArticle(true); setDialogOpen(true); }}>
              <FileText className="h-5 w-5 text-linkedin-warm" /> Article
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create Post Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{profile?.full_name || 'Your Name'}</p>
                <Button variant="outline" size="sm" className="h-6 text-xs rounded-full mt-0.5 px-2">
                  Post to Anyone ▾
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="px-4 pt-3 pb-2 flex-1">
            {isArticle && (
              <Input
                placeholder="Article title"
                value={articleTitle}
                onChange={e => setArticleTitle(e.target.value)}
                className="border-0 px-0 text-lg font-semibold focus-visible:ring-0 mb-2"
              />
            )}
            <Textarea
              placeholder="What do you want to talk about?"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[200px] resize-none border-0 p-0 focus-visible:ring-0 text-base"
              autoFocus
            />
            {imagePreview && (
              <div className="relative mt-3">
                <img src={imagePreview} alt="Preview" className="rounded-lg max-h-64 w-full object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 rounded-full"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Emoji button */}
          <div className="px-4 pb-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex items-center gap-0.5">
              <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => fileRef.current?.click()}>
                <Image className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" onClick={() => setIsArticle(!isArticle)}>
                <CalendarDays className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <Gift className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <Clock className="h-5 w-5" />
              </Button>
              <Button
                onClick={handlePost}
                disabled={!content.trim() || posting}
                size="sm"
                className="rounded-full px-5"
              >
                {posting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatePost;
