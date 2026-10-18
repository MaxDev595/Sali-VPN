import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';

type Account = { client_email: string; private_key: string; token_uri?: string };
@Injectable()
export class GooglePlayService {
  constructor(private readonly config: ConfigService) {}
  async verify(purchaseToken: string, productId: string) {
    const raw = this.config.getOrThrow<string>('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64');
    const account = JSON.parse(Buffer.from(raw, 'base64').toString()) as Account;
    const token = await this.oauth(account);
    const packageName = this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME') ?? 'app.sali.vpn';
    const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Google Play verification failed (${response.status})`);
    const body = await response.json() as any;
    if (!['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(body.subscriptionState)) throw new Error('Google Play subscription is not active');
    const line = body.lineItems?.find((item: any) => item.productId === productId);
    if (!line?.expiryTime) throw new Error('Google Play product does not match');
    return new Date(line.expiryTime);
  }
  private async oauth(account: Account) {
    const now = Math.floor(Date.now() / 1000), enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: account.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
    const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
    const assertion = `${unsigned}.${signer.sign(account.private_key).toString('base64url')}`;
    const response = await fetch(account.token_uri ?? 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
    if (!response.ok) throw new Error(`Google OAuth failed (${response.status})`);
    return ((await response.json()) as { access_token: string }).access_token;
  }
}
