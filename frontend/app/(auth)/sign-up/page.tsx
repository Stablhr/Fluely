'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Eye, EyeOff, UserPlus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useRouter} from 'next/navigation';
import {registerCustomer} from '@/lib/api/authApi';
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

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

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
      await registerCustomer({
        firstName,
        lastName,
        username,
        email,
        password,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setErrorMessage(
        getFriendlyErrorMessage(
          error,
          'Unable to create your account. Please try again.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

   return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className={authTitleClass}>
          Create an account
        </h2>
        <p className={authSubtitleClass}>
          Your app highlights 
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="firstName">First Name</Label>
          <Input
            className={authInputClass}
            id="firstName"
            type="text"
            placeholder="Juan"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

          <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="lastName">Last Name</Label>
          <Input
            className={authInputClass}
            id="lastName"
            type="text"
            placeholder="Dela Cruz"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

         <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="username">Username</Label>
          <Input
            className={authInputClass}
            id="username"
            type="text"
            placeholder="user@123"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

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

        <div className="space-y-2">
          <Label className={authLabelClass} htmlFor="password">Password</Label>
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
          <Label className={authLabelClass} htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            className={authInputClass}
            id="confirmPassword"
            placeholder="••••••••"
            type="password"
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
          <UserPlus className="size-[18px]" />
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </Button>

        {errorMessage && (
          <div className={authErrorClass}>
            {errorMessage}
          </div>
        )}
      </form>

      <p className={authFooterClass}>
        Already have an account?{' '}
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