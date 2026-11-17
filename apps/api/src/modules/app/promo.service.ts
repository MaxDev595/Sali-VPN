import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PromoKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const PROMO_PLAN = { code: 'promo_days', name: 'Sali Pro · промокод' } as const;

/** «SALI-2026», «summer 20» → «SALI-2026», «SUMMER20». */
export const normalizePromo = (input: string) => input.trim().toUpperCase().replace(/\s+/g, '');

/**
 * Promo codes made by the admin in the app.
 *  DAYS     — adds days to the account at once;
 *  DISCOUNT — a share off the next purchase (the app keeps it and sends it with the purchase).
 * Each account can use a code once; maxUses caps the total.
 */
@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService, private readonly subscriptions: SubscriptionsService) {}

  private async usable(rawCode: string, accountId: string) {
    const code = normalizePromo(rawCode);
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) throw new NotFoundException('Такого промокода нет');
    const used = await this.prisma.promoRedemption.findUnique({ where: { promoId_accountId: { promoId: promo.id, accountId } } });
    if (used) throw new ConflictException('Вы уже использовали этот промокод');
    if (promo.expiresAt && promo.expiresAt <= new Date()) throw new GoneException('Срок действия промокода закончился');
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) throw new GoneException('Промокод закончился');
    return promo;
  }

  exists(rawCode: string) {
    return this.prisma.promoCode.findUnique({ where: { code: normalizePromo(rawCode) } });
  }

  /** A DISCOUNT code checked right before a purchase. */
  async discountFor(rawCode: string, accountId: string) {
    const promo = await this.usable(rawCode, accountId);
    if (promo.kind !== PromoKind.DISCOUNT) throw new BadRequestException('Этот промокод даёт дни, а не скидку — введите его в разделе «Промокод»');
    return { id: promo.id, percent: promo.discountPercent, code: promo.code };
  }

  /** «Промокод» in the app. */
  async apply(rawCode: string, accountId: string) {
    const promo = await this.usable(rawCode, accountId);
    if (promo.kind === PromoKind.DISCOUNT) return { kind: 'DISCOUNT' as const, code: promo.code, percent: promo.discountPercent };

    await this.prisma.$transaction(async (tx) => {
      await tx.promoRedemption.create({ data: { promoId: promo.id, accountId } }).catch((error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Вы уже использовали этот промокод');
        throw error;
      });
      const taken = await tx.$executeRaw`UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${promo.id} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
      if (taken !== 1) throw new GoneException('Промокод закончился');
    });
    const plan = await this.prisma.plan.upsert({
      where: { code: PROMO_PLAN.code },
      update: {},
      create: { code: PROMO_PLAN.code, name: PROMO_PLAN.name, durationDays: 30, priceUsd: 0, maxDevices: 3, isActive: false },
    });
    const sub = await this.subscriptions.grantDays(accountId, plan.id, promo.days, 'promo');
    return { kind: 'DAYS' as const, code: promo.code, days: promo.days, until: sub.expiresAt?.toISOString() ?? null };
  }

  // ---- admin ----

  async list() {
    const rows = await this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((p) => ({
      id: p.id, code: p.code, kind: p.kind, days: p.days, discountPercent: p.discountPercent,
      maxUses: p.maxUses, usedCount: p.usedCount, expiresAt: p.expiresAt?.toISOString() ?? null,
      isActive: p.isActive, note: p.note, createdAt: p.createdAt.toISOString(),
    }));
  }

  async create(input: { code: string; kind: PromoKind; days?: number; discountPercent?: number; maxUses?: number | null; expiresInDays?: number | null; note?: string }, createdBy: string) {
    const code = normalizePromo(input.code);
    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) throw new BadRequestException('Промокод: 3–32 символа, латиница, цифры, - и _');
    if (/^SL-?[0-9A-Z]{4}-?[0-9A-Z]{4}$/.test(code)) throw new BadRequestException('Промокод не может выглядеть как Sali ID');
    if (input.kind === PromoKind.DAYS && !(Number.isInteger(input.days) && input.days! >= 1 && input.days! <= 3650)) throw new BadRequestException('Дней: от 1 до 3650');
    if (input.kind === PromoKind.DISCOUNT && !(Number.isInteger(input.discountPercent) && input.discountPercent! >= 1 && input.discountPercent! <= 90)) throw new BadRequestException('Скидка: от 1 до 90%');
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
    try {
      const row = await this.prisma.promoCode.create({
        data: {
          code, kind: input.kind,
          days: input.kind === PromoKind.DAYS ? input.days! : 0,
          discountPercent: input.kind === PromoKind.DISCOUNT ? input.discountPercent! : 0,
          maxUses: input.maxUses && input.maxUses > 0 ? input.maxUses : null,
          expiresAt, note: input.note?.slice(0, 200) || null, createdBy,
        },
      });
      return { id: row.id, code: row.code };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Такой промокод уже есть');
      throw error;
    }
  }

  async setActive(id: string, isActive: boolean) {
    await this.prisma.promoCode.update({ where: { id }, data: { isActive } });
    return { ok: true, isActive };
  }
}
