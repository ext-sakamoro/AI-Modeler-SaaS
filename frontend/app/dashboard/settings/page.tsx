'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState('Free');
  const [projectCount, setProjectCount] = useState(0);
  const [maxProjects, setMaxProjects] = useState(5);

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, api_key')
        .eq('id', user.id)
        .single();

      if (profile) {
        setPlan(profile.plan || 'Free');
        if (profile.api_key) setApiKey(profile.api_key);
        const limits: Record<string, number> = { Free: 5, Pro: 100, Enterprise: 999999 };
        setMaxProjects(limits[profile.plan] || 5);
      }

      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      setProjectCount(count || 0);
    } catch {
      // Supabase not configured
    }
  };

  const handleGenerateKey = async () => {
    const key = `amsk_${Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;
    setApiKey(key);

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ api_key: key })
          .eq('id', user.id);
      }
    } catch {
      // Supabase not configured — key stays in state only
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API Access</h2>
        <p className="text-sm text-muted-foreground">
          Use API keys to access AI Modeler programmatically via REST API.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={apiKey}
            readOnly
            placeholder="Click Generate to create an API key"
            className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm font-mono"
          />
          {apiKey ? (
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          ) : (
            <button
              onClick={handleGenerateKey}
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Generate'}
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="space-y-2">
          {email && (
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{email}</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="text-sm font-medium">{plan}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Projects</span>
            <span className="text-sm font-medium">
              {projectCount} / {maxProjects > 99999 ? 'Unlimited' : maxProjects}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
