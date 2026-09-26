'use client';

import {useMemo, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator
} from '@/components/ui/input-otp';
import {resendVerificationCode, verifyCustomerEmail} from '@/lib/api/authApi';
import {
  verifyPasswordResetCode,
  resendPasswordResetCode
} from '@/lib/api/authApi';
import {getFriendlyErrorMessage} from '@/lib/api/getFriendlyErrorMessage';
import {
  authErrorClass,
  authFooterClass,
  authInlineLinkClass,
  authLabelClass,
  authPrimaryButtonClass,
  authSubtitleClass,
  authTitleClass,
} from '@/lib/auth/authStyles';

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = searchParams.get('email') ?? '';
  const mode = searchParams.get('mode'); // 'reset' or null (signup)
  const isResetMode = mode === 'reset';

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return emailFromQuery.trim().length > 0 && code.trim().length === 6;
  }, [emailFromQuery, code]);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isResetMode) {
        await verifyPasswordResetCode({
          email: emailFromQuery.trim(),
          code: code.trim()
        });
        router.push(
          `/reset-password?email=${encodeURIComponent(emailFromQuery.trim())}&code=${code.trim()}`
        );
      } else {
        await verifyCustomerEmail({
          email: emailFromQuery.trim(),
          code: code.trim()
        });
        setSuccessMessage('Your email has been verified. You can now sign in.');
        router.push('/sign-in');
      }
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Verification failed.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResending) return;

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isResetMode) {
        await resendPasswordResetCode({email: emailFromQuery.trim()});
        setSuccessMessage('Reset code resent. Please check your email.');
      } else {
        await resendVerificationCode({email: emailFromQuery.trim()});
        setSuccessMessage('Verification code resent. Please check your email.');
      }
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error, 'Failed to resend code.'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className={authTitleClass}>
          {isResetMode ? 'Check your email' : 'Verify your email'}
        </h2>
        <p className={authSubtitleClass}>
          {isResetMode
            ? `Enter the 6-digit code we sent to ${emailFromQuery} to reset your password.`
            : 'Enter the 6-digit code we sent to your email address.'}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="otp">Verification Code</Label>
          <div className="flex justify-center">
            <InputOTP
              id="otp"
              maxLength={6}
              value={code}
              onChange={(value: string) =>
                setCode(value.replace(/\D/g, '').slice(0, 6))
              }
              disabled={isSubmitting}
              autoComplete="one-time-code"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          size="lg"
          disabled={isSubmitting || !canSubmit}
        >
          {isSubmitting
            ? 'Verifying...'
            : isResetMode
              ? 'Verify & Continue'
              : 'Verify Email'}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={handleResend}
          disabled={isResending || emailFromQuery.trim().length === 0}
        >
          {isResending ? 'Resending...' : 'Resend code'}
        </Button>

        {errorMessage && (
          <div className={authErrorClass}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {successMessage}
          </div>
        )}
      </form>

      <p className={authFooterClass}>
        {isResetMode ? (
          <>
            Remember your password?{' '}
            <Link
              href="/sign-in"
              className={authInlineLinkClass}
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            Already verified?{' '}
            <Link
              href="/sign-in"
              className={authInlineLinkClass}
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
