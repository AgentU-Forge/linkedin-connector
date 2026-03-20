import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Premium = () => {
  const plans = [
    {
      name: 'Career',
      price: '$29.99/mo',
      features: ['InMail messages', 'See who viewed your profile', 'Salary insights', 'Resume insights'],
    },
    {
      name: 'Business',
      price: '$59.99/mo',
      features: ['Everything in Career', 'Unlimited people browsing', 'Business insights', 'PowerPoint exports'],
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Premium Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">Stripe payment integration coming soon. Provide your API key to enable payments.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map(plan => (
              <Card key={plan.name} className="border-2">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-2xl font-bold text-primary mt-2">{plan.price}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-linkedin-green" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-6" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Premium;
