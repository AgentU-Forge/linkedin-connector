import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BotMessageSquare } from 'lucide-react';

const AIAssistant = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BotMessageSquare className="h-5 w-5" /> AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BotMessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold">AI Assistant coming soon</p>
            <p className="text-sm">This feature will be powered by your AI chatbot API key.</p>
            <p className="text-sm mt-2">Features planned: Resume builder, cover letter generator, career advice.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAssistant;
