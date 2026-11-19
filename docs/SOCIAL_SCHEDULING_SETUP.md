# Social scheduling: what you need to set up

Fluely can schedule posts to **Instagram, Facebook, TikTok, YouTube and LinkedIn**.
The code for every platform is in place. Each platform has its own mode:

| Mode | What happens |
|------|--------------|
| `dryrun` (default) | Everything runs except the final "post it" call. The post is marked published with a simulated id. Use this until a platform approves your app. |
| `live` | Real posts go out. |
| `disabled` | The platform is hidden from connecting and scheduling. |

Set the mode with `<PLATFORM>_MODE` in `backend/.env` and in Vercel (backend project),
for example `LINKEDIN_MODE=live`.

If a platform has **no client id / secret** set, "Connect" creates a demo account so you can
try the whole flow. Once you add real credentials, "Connect" runs the real sign-in, even in
`dryrun` mode, so you can test connecting before the platform approves publishing.

Accounts are **shared per workspace**: anyone in the workspace can schedule to an account
that a teammate connected.

---

## 0. Things every platform asks for (do these first)

1. **A public privacy policy URL and terms of service URL** on your own domain.
   Every platform's review rejects apps without them. Fluely has them built in; once the
   frontend is deployed, use:
   - Privacy policy: `https://<your-frontend-domain>/privacy`
   - Terms of service: `https://<your-frontend-domain>/terms`
   - Data deletion instructions (Meta asks for this): `https://<your-frontend-domain>/privacy#data-deletion`

   Have someone review the wording before you submit: add your company's legal name and
   address if the platform asks for them.
2. **An app icon** (1024×1024 PNG). Use your chosen logo once it is final.
3. **A domain you own** for production (Vercel's `*.vercel.app` works for testing, but
   Meta and TikTok want a domain you can verify).
4. **The backend's public URL.** Set `API_PUBLIC_URL` in `backend/.env`
   (`http://localhost:5001` locally, your backend's https URL in Vercel).
5. **A token-encryption key.** Generate one and put it in `SOCIAL_TOKEN_KEY`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Keep it secret and never change it after accounts are connected (the stored tokens
   could no longer be read; everyone would have to reconnect).

### Redirect URIs to register

Every platform asks for an "OAuth redirect URI". Register **both** of these for each one,
replacing `<platform>` with `linkedin`, `facebook`, `instagram`, `tiktok` or `youtube`:

```
http://localhost:5001/api/social-accounts/oauth/<platform>/callback
https://<your-backend-domain>/api/social-accounts/oauth/<platform>/callback
```

(TikTok and Meta refuse `http://` in production apps; for local testing with them, use a
tunnel such as `ngrok` and set `API_PUBLIC_URL` to the tunnel URL.)

---

## 1. LinkedIn (personal profiles now, Company Pages later)

1. Go to <https://www.linkedin.com/developers/apps> → **Create app**.
   It must be linked to a LinkedIn **Company Page** (create one for Fluely if needed).
2. **Products** tab → add **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
   Both are self-serve (approved instantly).
3. **Auth** tab → add the two redirect URIs above, then copy the **Client ID** and **Client Secret**.
4. For **Company Pages**: Products tab → request **Community Management API**.
   LinkedIn reviews this (can take weeks; they ask about your use case and company).
   When it is approved, set `LINKEDIN_ORGANIZATIONS=true`.

```env
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_MODE=live          # personal posting works right after step 2
LINKEDIN_ORGANIZATIONS=false
```

Limits: LinkedIn tokens last 60 days and cannot be refreshed for most apps, so people will
be asked to reconnect about every two months. Text and image posts are supported; video
posts to LinkedIn are not built yet.

## 2. Facebook Pages and Instagram (one Meta app for both)

Meta's setup changed in 2025: apps are built around **use cases**.

1. Go to <https://developers.facebook.com/apps> → **Create app**.
   - **App name:** Fluely. Pick the **use case "Manage everything on your Page"**.
   - Connect it to your **business portfolio** (create one if asked).
2. **Use cases → Manage everything on your Page → Customize → Permissions:** add
   `pages_manage_posts` and `pages_read_engagement` (keep `pages_show_list` and
   `business_management`).
3. **Use cases → … → Settings (Facebook Login for Business):** add the redirect URI for
   `facebook` (and later `instagram`), click **Check URI**, save.
   - Optional: create a **configuration** with a *User access token* and those permissions,
     and put its id in `META_LOGIN_CONFIG_ID`. Without one, Fluely asks for the permissions directly.
4. **App settings → Basic:** copy the **App ID** and **App secret**; add the privacy policy
   (`/privacy`), data deletion URL (`/privacy#data-deletion`), terms (`/terms`), icon and domain.
5. While the app is unpublished, only people with a role on it (**App roles**) can connect, and
   posts are visible only to them. That's enough for testing with your own Page.
6. To go public: **business verification**, then **App Review** for `pages_manage_posts`,
   `pages_read_engagement` (and the Instagram permissions), each with a screencast, then **Publish**.
7. **Instagram:** add the use case **"Manage messaging & content on Instagram"** to the same app
   (permissions `instagram_basic`, `instagram_content_publish`). The Instagram account must be a
   **Business or Creator** account **linked to a Facebook Page**.

Rules the platforms enforce (not Fluely):

- Facebook: only **Pages** can be posted to, not personal profiles.
- Instagram: every post needs an image or a video (no text-only posts).

```env
META_APP_ID=
META_APP_SECRET=
META_LOGIN_CONFIG_ID=          # optional
META_INSTAGRAM_CONFIG_ID=      # optional
FACEBOOK_MODE=dryrun
INSTAGRAM_MODE=dryrun
META_GRAPH_VERSION=v25.0
```

## 3. TikTok

1. Go to <https://developers.tiktok.com/apps> → **Create app**.
2. Add the products **Login Kit** and **Content Posting API** (enable **Direct Post**).
3. Scopes: `user.info.basic`, `video.publish`.
4. Add the redirect URIs, privacy policy, terms and icon. Copy the **Client key** and **Client secret**.
5. Submit the app for review, then apply for the **Content Posting API audit**.
   **Until the audit passes, TikTok only allows private posts** (`SELF_ONLY`), so keep
   `TIKTOK_PRIVACY=SELF_ONLY` until then.

TikTok posts must be videos.

```env
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_MODE=dryrun
TIKTOK_PRIVACY=SELF_ONLY    # PUBLIC_TO_EVERYONE after the audit
```

## 4. YouTube

1. Go to <https://console.cloud.google.com> → create a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **OAuth consent screen** → External → fill in the app name, support email, privacy policy,
   terms, logo and domain. Add the scopes `youtube.upload` and `youtube.readonly`.
   While the app is in **Testing**, add each person who will connect under **Test users**.
4. **Credentials → Create OAuth client ID → Web application** → add the redirect URIs.
   Copy the **Client ID** and **Client secret**.
5. **Publish** the consent screen and request **verification** (Google asks for a demo video).
   Then fill in the **YouTube API Services audit** form. Until the audit passes, videos uploaded
   by the API are locked to private.

YouTube posts must be videos. The default quota (10,000 units/day) allows about 6 uploads a day;
request more in the audit form.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_MODE=dryrun
```

## 5. Upstash QStash (sends each post at its exact time)

1. Sign up at <https://console.upstash.com> → **QStash**.
2. Copy **QSTASH_TOKEN**, **QSTASH_CURRENT_SIGNING_KEY** and **QSTASH_NEXT_SIGNING_KEY**.
   If the console shows a regional URL (for example `https://qstash-us-east-1.upstash.io`),
   copy it into `QSTASH_URL`.
3. Add them to the **backend** project in Vercel.

```env
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
QSTASH_URL=https://qstash.upstash.io
```

QStash has to reach your backend over the internet, so it does not work against
`localhost`. Without `QSTASH_TOKEN`, the local backend checks for due posts every 30 seconds
by itself instead, which is what you will use while developing.

---

## Checklist

- [x] Privacy policy and terms pages built (/privacy, /terms) — deploy them so they are live
- [ ] `API_PUBLIC_URL` and `SOCIAL_TOKEN_KEY` set locally and in Vercel
- [ ] LinkedIn app created, Share on LinkedIn + OpenID Connect added, keys in `.env`
- [ ] LinkedIn Community Management API requested (for Company Pages)
- [ ] Meta app created, business verified, App Review submitted
- [ ] TikTok app created, Content Posting API audit submitted
- [ ] Google project created, consent screen verified, YouTube audit submitted
- [ ] Upstash QStash keys in Vercel
- [ ] Switch each `<PLATFORM>_MODE` to `live` when that platform approves
