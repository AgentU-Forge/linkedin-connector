import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms and Conditions</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-4 text-sm text-muted-foreground">
            <p><strong>Last updated:</strong> March 25, 2026</p>

            <h3 className="text-foreground font-semibold text-base">1. Acceptance of Terms</h3>
            <p>By accessing and using PRO NET, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use this platform.</p>

            <h3 className="text-foreground font-semibold text-base">2. User Accounts</h3>
            <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration and to update your information as necessary.</p>

            <h3 className="text-foreground font-semibold text-base">3. Acceptable Use</h3>
            <p>You agree to use PRO NET only for lawful purposes and in a manner that does not infringe the rights of others. You must not:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Post false, misleading, or defamatory content</li>
              <li>Harass, bully, or intimidate other users</li>
              <li>Share spam, malware, or unauthorized advertisements</li>
              <li>Impersonate another person or entity</li>
              <li>Attempt to gain unauthorized access to the platform</li>
            </ul>

            <h3 className="text-foreground font-semibold text-base">4. Content Ownership</h3>
            <p>You retain ownership of the content you post on PRO NET. By posting content, you grant PRO NET a non-exclusive, worldwide license to display and distribute your content within the platform.</p>

            <h3 className="text-foreground font-semibold text-base">5. Privacy</h3>
            <p>Your use of PRO NET is also governed by our Privacy Policy. We collect and process your data to provide and improve our services. We do not sell your personal data to third parties.</p>

            <h3 className="text-foreground font-semibold text-base">6. Account Termination</h3>
            <p>PRO NET reserves the right to suspend or terminate your account if you violate these terms. You may also delete your account at any time by contacting support.</p>

            <h3 className="text-foreground font-semibold text-base">7. Limitation of Liability</h3>
            <p>PRO NET is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>

            <h3 className="text-foreground font-semibold text-base">8. Changes to Terms</h3>
            <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>

            <h3 className="text-foreground font-semibold text-base">9. Contact</h3>
            <p>If you have any questions about these terms, please reach out through the PRO NET platform.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
