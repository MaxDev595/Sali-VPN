import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.updateMany({ where: { code: 'pro_annual' }, data: { isActive: false } });
  const plan = await prisma.plan.upsert({
    where: { code: 'pro_monthly' },
    update: {},
    create: {
      code: 'pro_monthly',
      name: 'Sali Pro',
      durationDays: Number(process.env.SUBSCRIPTION_DURATION_DAYS ?? 30),
      priceUsd: Number(process.env.SUBSCRIPTION_PRICE_USD ?? 5),
      originalPriceUsd: Number(process.env.SUBSCRIPTION_ORIGINAL_PRICE_USD ?? 8),
      maxDevices: Number(process.env.MAX_DEVICES_PER_PLAN ?? 3),
      isActive: true,
    },
  });

  await prisma.vpnServer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: { premiumOnly: true, countryCode: 'DE', city: 'Frankfurt', pingMs: 45 },
    create: { id: '00000000-0000-0000-0000-000000000002', name: 'Sali DE-1', location: 'Germany', publicHost: process.env.WIREGUARD_SERVER_PUBLIC_HOST ?? '127.0.0.1', publicPort: Number(process.env.WIREGUARD_SERVER_PUBLIC_PORT ?? 51820), provider: 'wireguard', isActive: true, premiumOnly: true, countryCode: 'DE', city: 'Frankfurt', pingMs: 45 },
  });
  await prisma.vpnServer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: { premiumOnly: true, countryCode: 'US', city: 'New York', pingMs: 88 },
    create: { id: '00000000-0000-0000-0000-000000000003', name: 'Sali US-1', location: 'United States', publicHost: process.env.WIREGUARD_SERVER_PUBLIC_HOST ?? '127.0.0.1', publicPort: Number(process.env.WIREGUARD_SERVER_PUBLIC_PORT ?? 51820), provider: 'wireguard', isActive: true, premiumOnly: true, countryCode: 'US', city: 'New York', pingMs: 88 },
  });

  const server = await prisma.vpnServer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { premiumOnly: false, countryCode: 'NL', city: 'Amsterdam', pingMs: 32 },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Sali NL-1',
      location: process.env.WIREGUARD_SERVER_LOCATION ?? 'Netherlands',
      publicHost: process.env.WIREGUARD_SERVER_PUBLIC_HOST ?? 'vpn1.your-domain.example',
      publicPort: Number(process.env.WIREGUARD_SERVER_PUBLIC_PORT ?? 51820),
      provider: 'wireguard',
      isActive: true,
      premiumOnly: false,
      countryCode: 'NL',
      city: 'Amsterdam',
      pingMs: 32,
    },
  });

  console.log('Seeded plan:', plan.code);
  console.log('Seeded server:', server.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
