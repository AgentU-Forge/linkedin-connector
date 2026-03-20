import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const Jobs = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search for jobs..." className="pl-9" />
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold">Jobs feature coming soon</p>
            <p className="text-sm">We're working on bringing job listings to the platform.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Jobs;
