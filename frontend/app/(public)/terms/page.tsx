import type {Metadata} from 'next';
import Link from 'next/link';
import {LEGAL_CONTACT, LegalPage, type LegalSection} from '@/components/legal/LegalPage';
import {BRAND} from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: `The terms for using ${BRAND.name}.`
};

const n = BRAND.name;

const sections: LegalSection[] = [
  {
    id: 'the-service',
    title: 'The service',
    body: <p>{n} is a workspace for planning projects and scheduling social media content. These terms apply whenever you use {n}. By creating an account or using the service you agree to them.</p>
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <ul>
        <li>Give accurate information and keep your password secure. You are responsible for activity on your account.</li>
        <li>You must be at least 16, and authorised to act for any organisation you use {n} for.</li>
        <li>Tell us straight away at <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> if you think your account has been misused.</li>
      </ul>
    )
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <p>You own what you create in {n}. You give us permission to store, process and display it, and to send it to the platforms you choose, only so we can provide the service to you and the people you share it with. You are responsible for having the rights to everything you upload or publish.</p>
    )
  },
  {
    id: 'social-accounts',
    title: 'Connected social accounts',
    body: (
      <>
        <p>When you connect a social account you authorise {n} to publish the posts you or your workspace schedule to it. You remain responsible for those posts and for following each platform&apos;s rules, including the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>, Meta&apos;s Terms and Community Standards, LinkedIn&apos;s User Agreement and TikTok&apos;s Terms of Service.</p>
        <p>Platforms can change, limit or refuse posts at any time. We will tell you when a post fails, but we can&apos;t guarantee that every scheduled post is published or that it appears exactly as previewed.</p>
      </>
    )
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <ul>
        <li>No illegal, harmful, deceptive or infringing content, spam or harassment.</li>
        <li>No attempts to break, overload, reverse-engineer or get around the security of {n}.</li>
        <li>No access to other people&apos;s accounts or data without permission.</li>
      </ul>
    )
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: <p>We work to keep {n} available and secure, but the service is provided &quot;as is&quot; and may change, be interrupted or have errors. We may update features; we will give notice of significant changes where we can.</p>
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: <p>You can stop using {n} and delete your account at any time in Settings. We may suspend or close accounts that break these terms, after notice where reasonable. What happens to your data is described in our <Link href="/privacy">privacy policy</Link>.</p>
  },
  {
    id: 'liability',
    title: 'Liability',
    body: <p>To the extent the law allows, {n} is not liable for indirect or consequential losses, or for losses caused by social platforms, by content you publish, or by events outside our reasonable control. Nothing in these terms limits liability that cannot be limited by law.</p>
  },
  {
    id: 'changes-and-contact',
    title: 'Changes and contact',
    body: <p>If we change these terms we will update the date above and tell you about significant changes. Questions: <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p>
  }
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro={<p>These terms set out how you may use {n}, and what you and we can each expect.</p>}
      sections={sections}
    />
  );
}
