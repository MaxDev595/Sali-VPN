# Sali VPN Privacy Policy

**Effective date:** September 5, 2026  
**Last updated:** November 10, 2026

This policy explains what data **Sali VPN** processes across its Telegram bot, Android and Windows apps, website, API and VPN servers. We are specific about what we keep, what we don't, and why. If anything here differs from how the service actually works, that is a bug and we will fix it.

## 1. Who we are

**Operator:** Sali VPN  
**Country of registration:** Kazakhstan  
**Email:** work@salivpn.com  
**Support:** @SaliVPNHelpBot

## 2. The short version

**Sali VPN keeps no activity logs.** We do not store:

- the sites, apps and services you use;
- your DNS queries;
- the contents of your traffic;
- your real IP address;
- when you connect or disconnect, or how long sessions last;
- how much traffic an individual user transfers.

This is not a promise to "try": our database has no fields for any of this, and our VPN servers do not record it (see section 4).

## 3. What we keep

Only what the service cannot work without.

### 3.1 Account

- Sali ID — your account number (e.g. SL-7K4P-Q2M9);
- Telegram ID, plus the name, username and language Telegram passes to the bot — so the bot can send codes and reminders;
- an anonymised app-installation identifier (a hash, not a phone number or IMEI) — to link the app to your account;
- settings: interface language, whether notifications are on.

### 3.2 Subscription and devices

- plan, subscription start and end dates, activation codes and their status;
- your devices: name, platform and the **day** each was last used (no time of day; overwritten, so there is no history);
- referral invitations and earned rewards.

### 3.3 VPN access

- your device's WireGuard public key;
- the device's private key, **encrypted** (AES-256-GCM with a dedicated key used for nothing else) — so we can give you the same configuration again and move you to another server without a reinstall;
- your address inside the tunnel (like 10.67.x.x) — it stays the same and reveals nothing about who you are or what you do;
- the server your device is assigned to.

### 3.4 Payments

- amount, currency, method, status and date;
- the provider's payment ID (Telegram Stars, Paddle);
- for USDT: receiving address, amount and TON transaction hash.

We never receive or store card details — the payment provider handles them.

### 3.5 Support

If you contact support, we keep your messages. Please never send passwords, seed phrases or card details.

## 4. How our VPN servers work

- **No traffic logs.** Our servers run AmneziaWG and WireGuard, which keep no connection logs. Our server agent stores only the list of public keys and tunnel addresses, and reports nothing but the number of connected devices and server load.
- **Our own no-log DNS.** DNS queries are answered on the same VPN server by our resolver (Unbound) with query logging off, DNSSEC validation and QNAME minimisation. Your queries never go to Google or Cloudflare.
- **System logs live in memory only.** They are size-capped, erased after a day and on reboot. Nothing is written to disk.
- **Users are isolated.** Traffic between VPN clients is blocked, so other users can't see your device. Access from the VPN to the hosting provider's internal networks is blocked too.

**What is technically unavoidable.** While you are connected, the server keeps your current IP address and the time of the tunnel's last handshake in memory, and the NAT table holds your active connections. Without that, replies from the internet could not reach you. None of it is saved or shared, and it disappears shortly after you disconnect or when the server restarts. Every VPN works this way.

## 5. Third-party services

| Service | Purpose | What it sees |
|---|---|---|
| Telegram | bot, support, Stars payments | your chat with the bot, under Telegram's rules |
| Render (USA) | runs the API and bot | API requests; may keep its own technical logs, including the app's IP address when it calls the API |
| Neon | database | the data in section 3; VPN keys in it are encrypted |
| Cloudflare | salivpn.com website | website requests, under its own rules |
| VPS hosting (e.g. Hetzner) | VPN servers | encrypted tunnel traffic; no access to our keys |
| Telegram Stars, Paddle, TON network | payments | payment data, under their own rules |

None of them receives a history of your internet activity from us — we don't have one.

## 6. Why we use data

To grant access and configurations, manage subscriptions and devices, take payments, answer support requests, protect the service from abuse (such as claiming the free period twice) and meet binding legal requirements.

We do **not** sell data, show ads, use advertising trackers or build user profiles.

## 7. Government requests

We can disclose only what we have, and only under a legally binding request that genuinely applies to Sali VPN. Because we keep no activity history, real IP addresses or connection times, we cannot say who visited which site, or when, through Sali VPN.

## 8. Retention and deletion

- Account and subscription data is kept while the account exists.
- On request to **work@salivpn.com** or @SaliVPNHelpBot we delete your account: we end the subscription, remove your keys from the VPN servers and delete your account data. Payment records may be kept as long as the law requires.
- Database backups are overwritten on the provider's standard cycle.

## 9. Security

HTTPS for the website and API; WireGuard/AmneziaWG encryption for the VPN; database keys encrypted with a dedicated key; pinned certificates between the API and servers; one-time tokens for adding servers; rate limiting. Android apps are signed with the Sali VPN key, and its certificate fingerprint is published next to every build.

No service can guarantee absolute security, but we minimise what there is to steal or demand in the first place.

## 10. Your rights

You can ask what we hold about you, get a copy, correct it or delete your account. Write to **work@salivpn.com** or @SaliVPNHelpBot. We may ask you to confirm the account is yours (for example, with a message from the linked Telegram account).

## 11. Children

Sali VPN is not intended for people below the age at which applicable law allows them to consent to data processing on their own. If we learn we received such data improperly, we will delete it.

## 12. Changes

We update this policy when the service or the law changes. The current version is at salivpn.com/privacy, with the date of the last update at the top.

## 13. Contact

**Sali VPN**  
Email: **work@salivpn.com**  
Telegram: **@SaliVPNHelpBot**  
Website: **salivpn.com**
