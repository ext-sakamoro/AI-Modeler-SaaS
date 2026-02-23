'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const PLANS = [
  {
    name: 'Free',
    priceId: null,
    description: 'Get started with basic SDF modeling',
    features: [
      '5 projects',
      'OBJ & STL export',
      '128 max resolution',
      '100 API calls/hour',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || null,
    description: 'Full power for serious creators',
    features: [
      '100 projects',
      'All 15 export formats',
      '512 max resolution',
      '10,000 API calls/hour',
      'Text-to-3D (500/day)',
      'All 126 node types',
      '5 collaborators',
    ],
  },
  {
    name: 'Enterprise',
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || null,
    description: 'For teams and organizations',
    features: [
      'Unlimited projects',
      'All formats + custom',
      '1024 max resolution',
      'Unlimited API calls',
      'Unlimited Text-to-3D',
      'SSO integration',
      '50 collaborators',
      'SLA & dedicated support',
    ],
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState('Free');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setMessage('Subscription activated successfully!');
    } else if (searchParams.get('cancelled') === 'true') {
      setMessage('Checkout cancelled.');
    }
    fetchCurrentPlan();
  }, [searchParams]);

  const fetchCurrentPlan = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();
      if (data?.plan) setCurrentPlan(data.plan);
    } catch {
      // Supabase not configured
    }
  };

  const handleUpgrade = async (planName: string, priceId: string | null) => {
    if (!priceId) return;
    setUpgrading(planName);
    setMessage(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage(data.error || 'Failed to start checkout');
      }
    } catch {
      setMessage('Failed to connect to payment service');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="text-muted-foreground">
        Choose a plan that fits your needs. All pricing is set by the platform operator.
      </p>

      {message && (
        <div className="bg-primary/10 text-primary text-sm p-3 rounded-md">{message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.name === currentPlan;
          return (
            <div
              key={plan.name}
              className={`border rounded-lg p-6 space-y-4 ${
                isCurrent ? 'border-primary' : 'border-border'
              }`}
            >
              <div>
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-0.5">*</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.name, plan.priceId)}
                className={`w-full py-2 rounded-md text-sm font-medium ${
                  isCurrent
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50'
                }`}
                disabled={isCurrent || upgrading !== null}
              >
                {isCurrent
                  ? 'Current Plan'
                  : upgrading === plan.name
                    ? 'Redirecting...'
                    : 'Upgrade'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
