import type {Metadata} from 'next';
import {LEGAL_CONTACT, LegalPage, type LegalSection} from '@/components/legal/LegalPage';
import {BRAND} from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${BRAND.name} collects, uses and protects your information, including connected social accounts.`
};

const n = BRAND.name;

const sections: LegalSection[] = [
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: (
      <>
        <p><strong>Account information.</strong> Your name, email address or phone number, password (stored only as a secure hash), profile photo and the profile details you choose to add.</p>
        <p><strong>Your content.</strong> The workspaces, boards, lists, cards, comments, reactions, files and social posts you and your teammates create in {n}.</p>
        <p><strong>Connected social accounts.</strong> When you connect Facebook, LinkedIn, TikTok or YouTube, we receive from that platform your account or page ID, display name, profile picture and an access token (and, where the platform provides one, a refresh token). We do not receive your password for those platforms.</p>
        <p><strong>Technical information.</strong> Basic request logs (such as IP address, browser and time of request) used for security, rate limiting and troubleshooting.</p>
      </>
    )
  },
  {
    id: 'how-we-use-it',
    title: 'How we use your information',
    body: (
      <ul>
        <li>To provide {n}: show your boards and calendar, and keep your team&apos;s work in sync.</li>
        <li>To publish the posts you schedule, to the accounts you chose, at the time you chose.</li>
        <li>To send account emails such as verification codes, password resets and board invitations.</li>
        <li>To keep the service secure and prevent abuse.</li>
      </ul>
    )
  },
  {
    id: 'social-platforms',
    title: 'Connected social platforms',
    body: (
      <>
        <p>{n} only asks each platform for the permissions needed to identify the account you connect and publish the posts you schedule. We use platform data only to provide those features to you; we do not sell it, use it for advertising or share it with anyone else.</p>
        <p>Connected accounts are shared within the workspace you connected them to, so your teammates can schedule posts to them. Anyone in the workspace can see the account name and picture, never its tokens.</p>
        <p><strong>YouTube and Google.</strong> {n} uses YouTube API Services. By connecting a YouTube channel you agree to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a>, and Google&apos;s handling of your data is described in the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>. {n}&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. You can revoke {n}&apos;s access at any time from your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google security settings</a>.</p>
        <p>You can also revoke access from each platform&apos;s own settings: Facebook (Business Integrations), LinkedIn (Permitted services) and TikTok (Manage app permissions).</p>
      </>
    )
  },
  {
    id: 'storage-and-security',
    title: 'Storage and security',
    body: (
      <ul>
        <li>Data is stored in a managed MongoDB database; uploaded files are stored with Cloudinary.</li>
        <li>Social account tokens are encrypted at rest (AES-256-GCM) and are never sent to your browser.</li>
        <li>Passwords are stored as one-way hashes. Connections use HTTPS.</li>
        <li>Access is limited to what each feature needs, and board content is visible only to the people it is shared with.</li>
      </ul>
    )
  },
  {
    id: 'sharing',
    title: 'Who we share information with',
    body: (
      <>
        <p>We do not sell your information. We share it only with the services that run {n} on our behalf (hosting, database, file storage, email delivery and job scheduling), and with the social platforms you connect, when you publish to them. We may disclose information if required by law.</p>
      </>
    )
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>We keep your information while your account is active. When you disconnect a social account, its tokens are deleted immediately.</p>
        <p>When you delete your account, your profile and the boards you own (with their lists, cards and files) are deleted, and you are removed from other people&apos;s boards and workspaces. A workspace you share with others is handed to another member rather than deleted, so social accounts you connected to it stay available to that team until someone disconnects them. Disconnect them first if you don&apos;t want that.</p>
      </>
    )
  },
  {
    id: 'data-deletion',
    title: 'Deleting your data',
    body: (
      <>
        <p>You can delete your data at any time:</p>
        <ul>
          <li><strong>A connected social account:</strong> in {n}, open Settings → Connected accounts and choose Disconnect. Its tokens are deleted straight away.</li>
          <li><strong>Your whole account:</strong> Settings → Danger Zone → Delete account.</li>
          <li><strong>By email:</strong> write to <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a> from the address on your account and we will delete your data within 30 days and confirm when it is done.</li>
        </ul>
        <p>Removing {n} from a platform&apos;s settings (for example Facebook&apos;s Business Integrations) also stops our access; let us know if you would like the related data deleted as well.</p>
      </>
    )
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <p>You can access, correct, export or delete your information, and object to how we use it. Most of this is available in Settings; for anything else, contact us. If you are in the Philippines, the EU, the UK or another region with data protection laws, you also have the rights those laws provide, including complaining to your data protection authority.</p>
    )
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>{n} is a tool for professionals and is not intended for anyone under 16.</p>
  },
  {
    id: 'changes-and-contact',
    title: 'Changes and contact',
    body: (
      <p>If we change this policy we will update the date above, and tell you in the app or by email for significant changes. Questions: <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>.</p>
    )
  }
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={<p>This policy explains what information {n} collects, how we use it, and the choices you have, including for the social media accounts you connect to schedule posts.</p>}
      sections={sections}
    />
  );
}
