'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Eye, EyeOff, LogIn} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useRouter} from 'next/navigation';
import {login} from '@/lib/api/authApi';
import {getFriendlyErrorMessage} from '@/lib/api/getFriendlyErrorMessage';
import {getDashboardPath} from '@/lib/auth/redirects';
import {holdForMinimum} from '@/lib/auth/loadingCurtain';
import {useLoadingScreen} from '@/lib/provider/LoadingScreenProvider';
import {
  authErrorClass,
  authFooterClass,
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authPasswordToggleClass,
  authPrimaryButtonClass,
  authSubtitleClass,
  authTitleClass,
} from '@/lib/auth/authStyles';

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {show, hide} = useLoadingScreen();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    const startedAt = Date.now();
    show('login');
    try {
      const users = await login({email, password});
      // Hold the curtain until MIN_CURTAIN_MS so the mascot gets a readable
      // pass, then hand off to the dashboard. Deliberately no hide() on
      // success: the curtain stays up across the navigation so the dashboard
      // never flashes in behind it.
      await holdForMinimum(startedAt);
      router.push(getDashboardPath(users.user.type));
    } catch (error) {
      hide();
      setErrorMessage(getFriendlyErrorMessage(error, 'Failed to sign in'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h2 className={authTitleClass}>Welcome back</h2>
        <p className={authSubtitleClass}>Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className={authLabelClass}>
            Email or Phone Number
          </Label>
          <Input
            id="email"
            type="text"
            className={authInputClass}
            placeholder="you@example.com or 09xxxxxxxxx"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={authLabelClass}>
              Password
            </Label>
            <Link href="/forgot-password" className={authInlineLinkClass}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`${authInputClass} pr-12`}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isSubmitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className={authPasswordToggleClass}
            >
              {showPassword ? (
                <EyeOff className="size-[18px]" />
              ) : (
                <Eye className="size-[18px]" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          size="lg"
          disabled={isSubmitting}
        >
          <LogIn className="size-[18px]" />
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>

        {errorMessage && <div className={authErrorClass}>{errorMessage}</div>}
      </form>

      <p className={authFooterClass}>
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className={authInlineLinkClass}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
