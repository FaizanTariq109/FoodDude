# Signup email deliverability review — Step 7B.1

Reviewed 2026-10-23. Read-only audit; no settings changed and no email sent.

Release update: the owner subsequently reported SPF PASS, DKIM PASS and DMARC PASS on a received confirmation message. These are owner-provided results, not an independently inspected message. SMTP, sender, templates, confirmation requirements and redirects remain unchanged for the Step 7B release.

## Verified configuration

- Linked Supabase project: FoodDude (`wtgjwcoinwcivtjtdunn`).
- Custom SMTP enabled: `smtp.gmail.com`, port 465, sender name FoodDude.
- The configured Gmail From address matches the authenticated SMTP account. The full account address and all credentials are intentionally omitted here.
- Site URL: `https://food-dude-eight.vercel.app`.
- Redirect allowlist: the production origin above, `http://localhost:3000`, and `http://localhost:3000/**`. Local entries are for development; production signup supplies the HTTPS production origin.
- Email signup and email confirmation are enabled; public Auth settings also report auto-confirm disabled.

Evidence came from a Supabase CLI **config pull** into an isolated ignored audit directory and a publishable-key read of public Auth settings. Only allowlisted non-secret fields were inspected. The CLI export does not contain a complete reusable SMTP configuration; do not push that audit export back to Supabase.

## What remains unknown

The CLI did not expose the current confirmation subject or template. No received message was available for independent inspection. The owner later reported authentication passes as noted above; current email copy, actual link destinations, and the precise reason for Spam placement remain **unconfirmed**. Matching sender and login rules out an obvious configuration mismatch; it does not establish inbox placement.

The App Password authenticates the SMTP connection. It does not independently establish sending reputation or guarantee delivery. Gmail's consumer SMTP service has anti-abuse and sending limits and is not a dedicated transactional-email monitoring service. Reputation, recipient behavior, message content and linked-domain reputation are plausible contributors, not proven diagnoses.

Supabase recommends focused authentication email, authenticated sender domains and attention to link reputation. Avoid mixing promotions into confirmation messages. See [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp). Google requires SPF or DKIM for all senders to personal Gmail, with additional requirements for bulk senders; passing authentication alone is not a guarantee of inbox delivery. See [Google sender guidelines](https://support.google.com/mail/answer/81126?hl=en).

## Confirmation-link review

The app's signup action passes `getAppOrigin()` as `emailRedirectTo`; production uses the HTTPS origin. The documented template contract is:

```html
<a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm your email</a>
```

The server confirmation route verifies the token hash, accepts supported confirmation types, sets private/no-store and no-referrer headers, and redirects to the fixed home route. This is a **source-code contract**, not evidence of the currently configured hosted template. See [Supabase templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Free immediate diagnostic steps

1. In Supabase Dashboard → Authentication → Emails, inspect the confirmation subject and template without changing them. Check that the deployed template follows the contract above and resolves to HTTPS. Never paste a live token or confirmation URL into a report.
2. In Gmail on desktop, open an existing affected email, select the message's three-dot **More** menu, then **Show original**. Read the SPF, DKIM and DMARC summary and `Authentication-Results`. If sharing later, remove recipient addresses, confirmation links, tokens and message IDs; only the authentication verdicts and sender domains are needed. No new test email is required for this step.
3. Check From, Return-Path, DKIM `d=` and alignment. For a `gmail.com` sender, Google controls that domain's DNS; the application owner cannot add SPF/DKIM/DMARC records to gmail.com.
4. Review existing Auth/SMTP delivery errors and rate limits. Avoid repeated signup/resend bursts. Keep email confirmation enabled.
5. For legitimate received mail, recipients can use **Not spam**. This is recipient feedback, not a guaranteed global fix.

Suggested future copy, subject to approval: subject **Confirm your FoodDude email**; short text explaining that someone requested a FoodDude account, one confirmation button, and an ignore-if-unrequested sentence. Omit restaurant marketing, offers, tracking links and unnecessary images. Do not replace the hosted template until it has been inspected and explicitly approved.

## Optional future SMTP alternatives

| Provider | Published free allowance checked on review date | Practical limitation |
| --- | --- | --- |
| Resend | 3,000 emails/month, 100/day | Production sending needs a verified domain you own; a free plan does not supply a free custom domain. |
| Brevo | 300 emails/day | Sender/domain verification and account restrictions still apply; reaching the daily cap can delay delivery. |

Sources: [Resend pricing](https://resend.com/pricing), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Brevo pricing plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [Brevo free-plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan). Allowances can change; verify again before adopting a provider.

A future custom-domain setup would use a domain already owned or separately approved for purchase, publish the provider's SPF/DKIM records, configure DMARC deliberately, verify alignment, and then approve an SMTP/template change. Do not spoof a Gmail From address through another provider. No provider guarantees inbox placement. No domain, paid service, new integration, credential change or delivery test was introduced in this task.

## Required manual actions and approval boundary

Inspect the current hosted subject/template and one existing affected message as described above. These are the missing evidence for a precise diagnosis. Keep the current setup unchanged until that review; any SMTP, sender, template or Auth-setting change needs a separate approval.
