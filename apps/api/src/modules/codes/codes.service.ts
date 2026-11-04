import { ConflictException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActivationCodeKind, ActivationCodeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrialsService } from '../trials/trials.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatCode, formatPublicId, newActivationCode, normalizeCode } from './code-format';

const CODE_TTL_DAYS = Number(process.env.ACTIVATION_CODE_TTL_DAYS ?? 90);
const DEFAULT_PLAN_CODE = 'pro_monthly';

export interface IssuedCode {
  code: string;
  display: string;
  kind: ActivationCodeKind;
  durationDays: number;
  planName: string | null;
  expiresAt: string;
}

@Injectable()
export class CodesService {
  private readonly logger = new Logger(CodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly trials: TrialsService,
    private readonly notifications: NotificationsService,
  ) {}

  private present(row: { code: string; kind: ActivationCodeKind; durationDays: number; expiresAt: Date; plan?: { name: string } | null }): IssuedCode {
    return {
      code: row.code,
      display: formatCode(row.code),
      kind: row.kind,
      durationDays: row.durationDays,
      planName: row.plan?.name ?? null,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  private async create(data: Omit<Prisma.ActivationCodeUncheckedCreateInput, 'code' | 'expiresAt'>) {
    const expiresAt = new Date(Date.now() + CODE_TTL_DAYS * 86_400_000);
    // 60 random bits: a collision is practically impossible, but retry anyway.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.activationCode.create({
          data: { ...data, code: newActivationCode(), expiresAt },
          include: { plan: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 4) {
          const existing = data.paymentId ? await this.prisma.activationCode.findUnique({ where: { paymentId: data.paymentId }, include: { plan: true } }) : null;
          if (existing) return existing;
          continue;
        }
        throw error;
      }
    }
    throw new Error('Could not allocate an activation code');
  }

  /** Called once a bot payment succeeds. Idempotent per payment. */
  async issueForPayment(paymentId: string) {
    const existing = await this.prisma.activationCode.findUnique({ where: { paymentId }, include: { plan: true } });
    if (existing) return this.present(existing);
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { plan: true } });
    const row = await this.create({
      kind: ActivationCodeKind.PAID,
      durationDays: payment.plan.durationDays,
      planId: payment.planId,
      ownerId: payment.userId,
      paymentId: payment.id,
    });
    return this.present(row);
  }

  /** Free tariff: one code per Telegram account, ever. */
  async issueFree(ownerId: string) {
    const previous = await this.prisma.activationCode.findFirst({ where: { ownerId, kind: ActivationCodeKind.FREE }, include: { plan: true } });
    if (previous) {
      if (previous.status === ActivationCodeStatus.ISSUED && previous.expiresAt > new Date()) return { ...this.present(previous), alreadyIssued: true };
      throw new ConflictException('Бесплатный тариф уже был получен на этот Telegram-аккаунт');
    }
    const row = await this.create({ kind: ActivationCodeKind.FREE, durationDays: 0, ownerId });
    return { ...this.present(row), alreadyIssued: false };
  }

  /** Admin / marketing: gift and promo codes. */
  async issueGift(ownerId: string, planCode: string, kind: ActivationCodeKind = ActivationCodeKind.GIFT, note?: string) {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { code: planCode } });
    return this.present(await this.create({ kind, durationDays: plan.durationDays, planId: plan.id, ownerId, note }));
  }

  async listForOwner(ownerId: string) {
    const rows = await this.prisma.activationCode.findMany({
      where: { ownerId, status: { not: ActivationCodeStatus.REVOKED } },
      include: { plan: true, redeemedBy: { select: { publicId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((row) => ({
      ...this.present(row),
      status: row.status,
      redeemedAt: row.redeemedAt?.toISOString() ?? null,
      redeemedOn: row.redeemedBy ? formatPublicId(row.redeemedBy.publicId) : null,
    }));
  }

  /**
   * Applies a code to an account (normally the store app's account).
   * Paid codes stack on top of an active subscription; FREE unlocks the trial.
   */
  async redeem(userId: string, rawCode: string) {
    const code = normalizeCode(rawCode);
    if (code.length !== 12) throw new NotFoundException('Код не найден. Проверьте, что он введён полностью: SALI-XXXX-XXXX-XXXX');

    const row = await this.prisma.activationCode.findUnique({ where: { code }, include: { plan: true } });
    if (!row || row.status === ActivationCodeStatus.REVOKED) throw new NotFoundException('Код не найден или отозван');
    if (row.status === ActivationCodeStatus.REDEEMED) {
      if (row.redeemedById === userId) throw new ConflictException('Этот код уже активирован на вашем устройстве');
      throw new ConflictException('Код уже был активирован на другом устройстве');
    }
    if (row.expiresAt <= new Date()) throw new GoneException('Срок действия кода истёк. Напишите в поддержку — поможем');

    if (row.kind === ActivationCodeKind.FREE) {
      const trial = await this.trials.getTrial(userId);
      const activeSub = await this.subscriptions.getActiveForUser(userId);
      if (trial || activeSub) throw new ForbiddenException('Бесплатный тариф уже использован на этом устройстве');
    }

    // Claim first so two devices racing on one code can't both win.
    const claimed = await this.prisma.activationCode.updateMany({
      where: { id: row.id, status: ActivationCodeStatus.ISSUED },
      data: { status: ActivationCodeStatus.REDEEMED, redeemedById: userId, redeemedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ConflictException('Код уже был активирован');

    try {
      let expiresAt: Date | null = null;
      if (row.kind === ActivationCodeKind.FREE) {
        const trial = await this.trials.startTrialIfNeeded(userId);
        expiresAt = trial.expiresAt;
      } else {
        const plan = row.plan ?? await this.prisma.plan.findUniqueOrThrow({ where: { code: DEFAULT_PLAN_CODE } });
        const subscription = await this.subscriptions.grantDays(userId, plan.id, row.durationDays, 'code');
        expiresAt = subscription.expiresAt;
      }
      void this.notifyRedeemed(row.ownerId, userId, row.code, row.kind, expiresAt);
      return {
        kind: row.kind,
        durationDays: row.kind === ActivationCodeKind.FREE ? 1 : row.durationDays,
        planName: row.plan?.name ?? (row.kind === ActivationCodeKind.FREE ? '24 часа бесплатно' : null),
        expiresAt: expiresAt?.toISOString() ?? null,
      };
    } catch (error) {
      // Roll the claim back so the customer can retry with the same code.
      await this.prisma.activationCode.update({ where: { id: row.id }, data: { status: ActivationCodeStatus.ISSUED, redeemedById: null, redeemedAt: null } });
      throw error;
    }
  }

  private async notifyRedeemed(ownerId: string, redeemerId: string, code: string, kind: ActivationCodeKind, expiresAt: Date | null) {
    try {
      const redeemer = await this.prisma.user.findUniqueOrThrow({ where: { id: redeemerId } });
      const until = expiresAt ? `\nДоступ до: <b>${expiresAt.toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</b>` : '';
      const what = kind === ActivationCodeKind.FREE ? 'Бесплатный тариф включён' : 'Подписка активирована';
      await this.notifications.sendHtml(
        ownerId,
        `✅ <b>${what}</b>\n\nКод <code>${formatCode(code)}</code> активирован на устройстве <b>${formatPublicId(redeemer.publicId)}</b>.${until}\n\nЕсли это были не вы — сразу напишите в поддержку.`,
      );
    } catch (error) {
      this.logger.warn(`Failed to notify code owner=${ownerId}`, error as Error);
    }
  }
}
