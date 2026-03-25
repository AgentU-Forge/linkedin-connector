import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-4 text-sm text-muted-foreground">
            <p><strong>Last updated:</strong> March 25, 2026</p>

            <h3 className="text-foreground font-semibold text-base">1. Information We Collect</h3>
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information (name, email, password)</li>
              <li>Profile data (headline, location, education, experience)</li>
              <li>Content you create (posts, comments, messages)</li>
              <li>Usage data and analytics</li>
            </ul>

            <h3 className="text-foreground font-semibold text-base">2. How We Use Your Information</h3>
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and maintain PRO NET services</li>
              <li>Connect you with other professionals</li>
              <li>Send notifications about relevant activity</li>
              <li>Improve our platform and user experience</li>
            </ul>

            <h3 className="text-foreground font-semibold text-base">3. Data Security</h3>
            <p>We implement appropriate security measures to protect your personal data. All data is encrypted in transit and at rest. We regularly review and update our security practices.</p>

            <h3 className="text-foreground font-semibold text-base">4. Data Sharing</h3>
            <p>We do not sell your personal data. Your profile information is visible to other PRO NET users according to your privacy settings. We may share anonymized data for analytics purposes.</p>

            <h3 className="text-foreground font-semibold text-base">5. Your Rights</h3>
            <p>You have the right to access, update, or delete your personal data at any time through your profile settings. You may also request a copy of your data by contacting us.</p>

            <h3 className="text-foreground font-semibold text-base">6. Cookies</h3>
            <p>We use cookies and similar technologies to maintain your session and improve your experience. You can control cookie settings through your browser preferences.</p>

            <h3 className="text-foreground font-semibold text-base">7. Contact</h3>
            <p>For privacy-related inquiries, please contact us through the PRO NET platform.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
