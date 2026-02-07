
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert'; // Added import
import { useToast } from '@/hooks/use-toast';
import { KeyRound, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ADMIN_AUTH_KEY = 'isAdminLoggedIn_KruthikaChat';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState(''); // Changed from username to email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Get return URL from query parameters, default to /admin/profile
  const returnUrl = searchParams.get('returnUrl') || '/admin/profile';

  // Check if already authenticated
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const isAuth = sessionStorage.getItem(ADMIN_AUTH_KEY);
        if (isAuth === 'true') {
          // Already logged in, redirect to return URL
          router.replace(returnUrl as any);
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    }
  }, [router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    setIsLoading(false);

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error || 'Invalid login credentials.');
      toast({ title: 'Login Failed', description: payload.error || 'Incorrect email or password.', variant: 'destructive' });
    } else {
      try {
        if (typeof window !== 'undefined') {
          // Store both the flag and session info for API verification
          sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
          // Session token is stored in a secure HTTP-only cookie.
        }
        toast({ title: 'Login Successful', description: "Welcome to the Admin Panel!" });
        // Redirect to the return URL (the page they were trying to access)
        router.push(returnUrl as any);
      } catch (sessionError: any) {
          console.error("Error setting sessionStorage:", sessionError);
          setError(`Failed to initiate session. Please ensure cookies/session storage are enabled. ${sessionError.message || ''}`);
          toast({ title: 'Session Error', description: `Could not save login state. ${sessionError.message || ''}`, variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <KeyRound size={32} />
          </div>
          <CardTitle className="text-2xl">Kruthika Chat Admin Panel</CardTitle>
          <CardDescription>Enter your admin credentials to access settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert size={20} className="mr-2 shrink-0 mt-0.5 !text-primary" />
            <div>
              <span className="font-semibold !text-primary">Admin Access:</span> Uses Hostinger database authentication. Make sure ADMIN_EMAIL/ADMIN_PASSWORD settings are configured in your environment.
            </div>
          </Alert>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email" // Changed type to email
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com" // Changed placeholder
                required
                className="text-base"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="text-base"
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full text-lg py-3" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
