'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Eye, EyeOff, KeyRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useRouter, useSearchParams} from 'next/navigation';
import {resetPassword} from '@/lib/api/authApi';
import {getFriendlyErrorMessage} from '@/lib/api/getFriendlyErrorMessage';
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

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = searchParams.get('email') ?? '';
  const codeFromQuery = searchParams.get('code') ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please try again.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await resetPassword({
        email: emailFromQuery.trim(),
        code: codeFromQuery.trim(),
        newPassword: password,
      });
      router.push('/sign-in');
    } catch (error) {
      setErrorMessage(
        getFriendlyErrorMessage(error, 'Unable to reset password. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className={authTitleClass}>
          Reset password
        </h2>
        <p className={authSubtitleClass}>
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              className={`${authInputClass} pr-12`}
              id="password"
              type={showPassword ? 'text' : 'password'}
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
              className={authPasswordToggleClass}
            >
              {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            className={authInputClass}
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          size="lg"
          disabled={isSubmitting}
        >
          <KeyRound className="size-[18px]" />
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </Button>

        {errorMessage && (
          <div className={authErrorClass}>
            {errorMessage}
          </div>
        )}
      </form>

      <p className={authFooterClass}>
        Remember your password?{' '}
        <Link
          href="/sign-in"
          className={authInlineLinkClass}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}