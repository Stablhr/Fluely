'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useRouter} from 'next/navigation';
import {getFriendlyErrorMessage} from '@/lib/api/getFriendlyErrorMessage';
import {
  authErrorClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authSubtitleClass,
  authTitleClass,
} from '@/lib/auth/authStyles';
import { sendPasswordResetCode } from '@/lib/api/authApi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await sendPasswordResetCode({email: email.trim()}); 
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&mode=reset`);
    } catch (error) {
      setErrorMessage(
        getFriendlyErrorMessage(error, 'Unable to send reset code. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/sign-in"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back to sign in
      </Link>

      <div className="space-y-2">
        <h2 className={authTitleClass}>
          Forgot password?
        </h2>
        <p className={authSubtitleClass}>
          Enter your email and we&apos;ll send you a 6-digit code to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="email">Email</Label>
          <Input
            id="email"
            className={authInputClass}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
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
          <Send className="size-[18px]" />
          {isSubmitting ? 'Sending...' : 'Send Code'}
        </Button>

        {errorMessage && (
          <div className={authErrorClass}>
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  );
}