import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, FileText, X } from 'lucide-react';
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
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post published!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar>
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            {isArticle && (
              <Input
                placeholder="Article title"
                value={articleTitle}
                onChange={e => setArticleTitle(e.target.value)}
              />
            )}
            <Textarea
              placeholder={isArticle ? "Write your article..." : "What do you want to talk about?"}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[80px] resize-none border-0 p-0 focus-visible:ring-0"
            />
            {imagePreview && (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="rounded-lg max-h-64 w-full object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex gap-1">
                <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  <Image className="h-4 w-4 mr-1 text-linkedin-blue" /> Photo
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsArticle(!isArticle)}>
                  <FileText className="h-4 w-4 mr-1 text-linkedin-warm" />
                  {isArticle ? 'Post' : 'Article'}
                </Button>
              </div>
              <Button onClick={handlePost} disabled={!content.trim() || posting} size="sm">
                {posting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreatePost;
