import {
  PrismaClient,
  PlanInterval,
  Role,
  SubscriptionStatus,
  PaymentStatus,
  type Plan,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function subDays(date: Date, days: number) {
  return addDays(date, -days)
}

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getSeedMode() {
  const explicit = (process.env.SEED_MODE || '').trim().toLowerCase()
  if (explicit === 'production' || explicit === 'prod') return 'production' as const
  if (explicit === 'development' || explicit === 'dev') return 'development' as const
  return process.env.NODE_ENV === 'production' ? 'production' as const : 'development' as const
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function seedCategories() {
  const categoriesData = [
    { name: 'TV Aberta', slug: 'tv-aberta', icon: 'TV', order: 1 },
    { name: 'TV Fechada', slug: 'tv-fechada', icon: 'SAT', order: 2 },
    { name: 'Esportes', slug: 'esportes', icon: 'BALL', order: 5 },
    { name: 'Noticias', slug: 'noticias', icon: 'NEWS', order: 6 },
    { name: 'Infantil', slug: 'infantil', icon: 'KIDS', order: 7 },
    { name: 'Documentarios', slug: 'documentarios', icon: 'DOC', order: 8 },
    { name: 'Musica', slug: 'musica', icon: 'MUSIC', order: 9 },
    { name: 'Series', slug: 'series', icon: 'SERIES', order: 10 },
    { name: 'Filmes', slug: 'filmes', icon: 'MOVIE', order: 20 },
    { name: 'Variedades', slug: 'variedades', icon: 'SHOW', order: 11 },
    { name: 'Internacional', slug: 'internacional', icon: 'WORLD', order: 15 },
    { name: 'Religioso', slug: 'religioso', icon: 'FAITH', order: 16 },
  ]

  for (const category of categoriesData) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { ...category, active: true },
      create: { ...category, active: true },
    })
  }

  return categoriesData.length
}

async function seedPlans() {
  const plansData = [
    {
      id: 'basico',
      name: 'Basico',
      description: '1 tela simultanea',
      price: 19.9,
      interval: PlanInterval.MONTHLY,
      durationDays: 30,
      maxDevices: 1,
      featured: false,
    },
    {
      id: 'premium',
      name: 'Premium',
      description: '2 telas simultaneas',
      price: 29.9,
      interval: PlanInterval.MONTHLY,
      durationDays: 30,
      maxDevices: 2,
      featured: true,
    },
    {
      id: 'familia',
      name: 'Familia',
      description: '4 telas simultaneas',
      price: 49.9,
      interval: PlanInterval.MONTHLY,
      durationDays: 30,
      maxDevices: 4,
      featured: false,
    },
    {
      id: 'anual-premium',
      name: 'Anual Premium',
      description: '2 telas com economia anual',
      price: 287.0,
      interval: PlanInterval.ANNUAL,
      durationDays: 365,
      maxDevices: 2,
      featured: false,
    },
    {
      id: 'trimestral',
      name: 'Trimestral',
      description: '2 telas por 3 meses',
      price: 79.9,
      interval: PlanInterval.QUARTERLY,
      durationDays: 90,
      maxDevices: 2,
      featured: false,
    },
  ]

  for (const plan of plansData) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: { ...plan, active: true },
      create: { ...plan, active: true },
    })
  }

  const storedPlans = await prisma.plan.findMany({
    where: { id: { in: plansData.map(plan => plan.id) } },
  })
  const byId = new Map(storedPlans.map(plan => [plan.id, plan]))

  return {
    count: plansData.length,
    plans: {
      basico: byId.get('basico') as Plan,
      premium: byId.get('premium') as Plan,
      familia: byId.get('familia') as Plan,
      anualPremium: byId.get('anual-premium') as Plan,
      trimestral: byId.get('trimestral') as Plan,
    },
  }
}

async function seedSystemConfig(defaultPlanId: string) {
  const configs = [
    { key: 'site_name', value: process.env.SEED_SITE_NAME?.trim() || 'IPTV' },
    { key: 'site_short_name', value: process.env.SEED_SITE_SHORT_NAME?.trim() || 'IPTV' },
    { key: 'site_logo_url', value: process.env.SEED_SITE_LOGO_URL?.trim() || '/logo-dark.png' },
    { key: 'site_logo_dark_url', value: process.env.SEED_SITE_LOGO_DARK_URL?.trim() || '/logo-dark.png' },
    { key: 'site_logo_light_url', value: process.env.SEED_SITE_LOGO_LIGHT_URL?.trim() || '/logo-white.png' },
    { key: 'primary_color', value: process.env.SEED_PRIMARY_COLOR?.trim() || '#73de90' },
    { key: 'featured_channel_uuid', value: '' },
    { key: 'featured_banner_url', value: '' },
    { key: 'default_plan_id', value: defaultPlanId },
    { key: 'support_email', value: process.env.SEED_SUPPORT_EMAIL?.trim() || 'suporte@iptv.local' },
    { key: 'support_whatsapp', value: process.env.SEED_SUPPORT_WHATSAPP?.trim() || '' },
    { key: 'pix_key', value: process.env.SEED_PIX_KEY?.trim() || 'suporte@iptv.local' },
    { key: 'mercadopago_access_token', value: process.env.SEED_MP_ACCESS_TOKEN?.trim() || '' },
    { key: 'expfypay_public_key', value: process.env.SEED_EXPFY_PUBLIC_KEY?.trim() || '' },
    { key: 'expfypay_secret_key', value: process.env.SEED_EXPFY_SECRET_KEY?.trim() || '' },
    { key: 'payment_gateway_provider', value: process.env.SEED_PAYMENT_GATEWAY_PROVIDER?.trim() || 'mercadopago' },
    { key: 'payment_gateway_mode', value: process.env.SEED_PAYMENT_GATEWAY_MODE?.trim() || 'single' },
    { key: 'payment_gateway_enabled', value: process.env.SEED_PAYMENT_GATEWAY_ENABLED?.trim() || 'mercadopago' },
    { key: 'payment_gateway_rotation_cursor', value: '0' },
    { key: 'commission_default', value: process.env.SEED_DEFAULT_COMMISSION?.trim() || '0.20' },
    { key: 'trial_days', value: process.env.SEED_TRIAL_DAYS?.trim() || '7' },
    { key: 'audit_retention_days', value: process.env.SEED_AUDIT_RETENTION_DAYS?.trim() || '90' },
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    })
  }

  return configs.length
}

async function seedAdmin(mode: 'production' | 'development') {
  const adminName = mode === 'production'
    ? (process.env.SEED_ADMIN_NAME?.trim() || 'Administrador')
    : 'Administrador'
  const adminEmail = mode === 'production'
    ? requireEnv('SEED_ADMIN_EMAIL').toLowerCase()
    : (process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || 'admin@iptv.local')
  const adminPassword = mode === 'production'
    ? requireEnv('SEED_ADMIN_PASSWORD')
    : (process.env.SEED_ADMIN_PASSWORD?.trim() || 'admin123')

  const hashedPassword = await bcrypt.hash(adminPassword, 12)
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      password: hashedPassword,
      role: Role.ADMIN,
      active: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
      active: true,
    },
  })

  return {
    id: admin.id,
    email: adminEmail,
    password: adminPassword,
    name: adminName,
  }
}

async function seedDevelopmentDemo(plans: {
  basico: Plan
  premium: Plan
  familia: Plan
  anualPremium: Plan
  trimestral: Plan
}) {
  const resellersData = [
    {
      name: 'Carlos Revendedor',
      email: 'carlos@revenda.com',
      password: 'carlos123',
      referralCode: 'CARLOS2024',
      commissionRate: 0.25,
      planId: plans.premium.id,
    },
    {
      name: 'Fernanda Distribuidora',
      email: 'fernanda@distribuidora.com',
      password: 'fernanda123',
      referralCode: 'FERNANDA10',
      commissionRate: 0.30,
      planId: plans.anualPremium.id,
    },
  ]

  const resellers: Array<{ id: string; commissionRate: number; referralCode: string | null }> = []

  for (const resellerSeed of resellersData) {
    const hashed = await bcrypt.hash(resellerSeed.password, 12)
    const reseller = await prisma.user.upsert({
      where: { email: resellerSeed.email },
      update: {
        name: resellerSeed.name,
        password: hashed,
        role: Role.RESELLER,
        active: true,
        referralCode: resellerSeed.referralCode,
        commissionRate: resellerSeed.commissionRate,
      },
      create: {
        name: resellerSeed.name,
        email: resellerSeed.email,
        password: hashed,
        role: Role.RESELLER,
        active: true,
        referralCode: resellerSeed.referralCode,
        commissionRate: resellerSeed.commissionRate,
      },
    })

    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId: reseller.id, planId: resellerSeed.planId },
    })

    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          userId: reseller.id,
          planId: resellerSeed.planId,
          status: SubscriptionStatus.ACTIVE,
          startsAt: new Date(),
          expiresAt: addDays(new Date(), 365),
          autoRenew: true,
          username: reseller.email,
          password: resellerSeed.password,
        },
      })
    }

    const clicksCount = await prisma.affiliateClick.count({
      where: { resellerId: reseller.id },
    })
    if (clicksCount === 0) {
      const totalClicks = randBetween(30, 60)
      for (let index = 0; index < totalClicks; index += 1) {
        await prisma.affiliateClick.create({
          data: {
            resellerId: reseller.id,
            ipAddress: `192.168.${randBetween(1, 254)}.${randBetween(1, 254)}`,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            converted: Math.random() < 0.35,
            createdAt: subDays(new Date(), randBetween(0, 60)),
          },
        })
      }
    }

    for (let month = 1; month <= 3; month += 1) {
      const reference = `PAY-${reseller.id.slice(0, 6).toUpperCase()}-M${month}`
      const existingPaidPayout = await prisma.payout.findFirst({
        where: { reference },
        select: { id: true },
      })
      if (!existingPaidPayout) {
        await prisma.payout.create({
          data: {
            resellerId: reseller.id,
            amount: parseFloat(String(randBetween(150, 600))),
            status: 'PAID',
            reference,
            paidAt: subDays(new Date(), month * 30),
            createdAt: subDays(new Date(), month * 30 + 5),
          },
        })
      }
    }

    const currentReference = `PAY-${reseller.id.slice(0, 6).toUpperCase()}-ATUAL`
    const existingPendingPayout = await prisma.payout.findFirst({
      where: { reference: currentReference },
      select: { id: true },
    })
    if (!existingPendingPayout) {
      await prisma.payout.create({
        data: {
          resellerId: reseller.id,
          amount: parseFloat(String(randBetween(200, 500))),
          status: 'PENDING',
          reference: currentReference,
          createdAt: new Date(),
        },
      })
    }

    resellers.push({
      id: reseller.id,
      commissionRate: resellerSeed.commissionRate,
      referralCode: resellerSeed.referralCode,
    })
  }

  const clientsData = [
    { name: 'Ana Silva', email: 'ana@email.com', password: 'ana123', planId: plans.premium.id, status: SubscriptionStatus.ACTIVE, daysOffset: -5, reseller: 0 },
    { name: 'Bruno Souza', email: 'bruno@email.com', password: 'bruno123', planId: plans.familia.id, status: SubscriptionStatus.ACTIVE, daysOffset: -10, reseller: 0 },
    { name: 'Carla Mendes', email: 'carla@email.com', password: 'carla123', planId: plans.basico.id, status: SubscriptionStatus.ACTIVE, daysOffset: -2, reseller: 0 },
    { name: 'Diego Pereira', email: 'diego@email.com', password: 'diego123', planId: plans.trimestral.id, status: SubscriptionStatus.ACTIVE, daysOffset: -15, reseller: 0 },
    { name: 'Elisa Costa', email: 'elisa@email.com', password: 'elisa123', planId: plans.anualPremium.id, status: SubscriptionStatus.ACTIVE, daysOffset: -30, reseller: 0 },
    { name: 'Fabio Lima', email: 'fabio@email.com', password: 'fabio123', planId: plans.premium.id, status: SubscriptionStatus.ACTIVE, daysOffset: -7, reseller: 1 },
    { name: 'Gisele Oliveira', email: 'gisele@email.com', password: 'gisele123', planId: plans.familia.id, status: SubscriptionStatus.ACTIVE, daysOffset: -20, reseller: 1 },
    { name: 'Hugo Ferreira', email: 'hugo@email.com', password: 'hugo123', planId: plans.basico.id, status: SubscriptionStatus.ACTIVE, daysOffset: -1, reseller: 1 },
    { name: 'Isabela Santos', email: 'isabela@email.com', password: 'isabela123', planId: plans.trimestral.id, status: SubscriptionStatus.ACTIVE, daysOffset: -45, reseller: 1 },
    { name: 'Joao Martins', email: 'joao@email.com', password: 'joao123', planId: plans.anualPremium.id, status: SubscriptionStatus.ACTIVE, daysOffset: -60, reseller: 1 },
    { name: 'Katia Rocha', email: 'katia@email.com', password: 'katia123', planId: plans.premium.id, status: SubscriptionStatus.ACTIVE, daysOffset: -3, reseller: null },
    { name: 'Lucas Barbosa', email: 'lucas@email.com', password: 'lucas123', planId: plans.basico.id, status: SubscriptionStatus.ACTIVE, daysOffset: -8, reseller: null },
    { name: 'Mariana Alves', email: 'mariana@email.com', password: 'mariana123', planId: plans.familia.id, status: SubscriptionStatus.ACTIVE, daysOffset: -12, reseller: null },
    { name: 'Natan Cruz', email: 'natan@email.com', password: 'natan123', planId: plans.basico.id, status: SubscriptionStatus.EXPIRED, daysOffset: -35, reseller: 0 },
    { name: 'Olivia Dias', email: 'olivia@email.com', password: 'olivia123', planId: plans.premium.id, status: SubscriptionStatus.EXPIRED, daysOffset: -65, reseller: 1 },
    { name: 'Paulo Cardoso', email: 'paulo@email.com', password: 'paulo123', planId: plans.basico.id, status: SubscriptionStatus.TRIAL, daysOffset: 0, reseller: null },
    { name: 'Queila Freitas', email: 'queila@email.com', password: 'queila123', planId: plans.premium.id, status: SubscriptionStatus.PENDING_PAYMENT, daysOffset: 0, reseller: null },
  ]

  let clientCount = 0

  for (const clientSeed of clientsData) {
    const hashed = await bcrypt.hash(clientSeed.password, 12)
    const user = await prisma.user.upsert({
      where: { email: clientSeed.email },
      update: { name: clientSeed.name, password: hashed, role: Role.CLIENT, active: true },
      create: {
        name: clientSeed.name,
        email: clientSeed.email,
        password: hashed,
        role: Role.CLIENT,
        active: true,
      },
    })

    const startsAt = subDays(new Date(), Math.abs(clientSeed.daysOffset))
    const expiresAt = clientSeed.status === SubscriptionStatus.EXPIRED
      ? subDays(new Date(), 5)
      : addDays(startsAt, getPlanDurationDays(clientSeed.planId, plans))
    const resellerId = clientSeed.reseller !== null ? resellers[clientSeed.reseller].id : null

    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId: user.id, planId: clientSeed.planId },
    })

    let subscription = existingSubscription
    if (!existingSubscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: clientSeed.planId,
          status: clientSeed.status,
          startsAt,
          expiresAt,
          autoRenew: clientSeed.status === SubscriptionStatus.ACTIVE,
          username: user.email,
          password: clientSeed.password,
          resellerId,
          createdAt: startsAt,
          updatedAt: startsAt,
        },
      })
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { userId: user.id, planId: clientSeed.planId },
    })

    if (!existingPayment && subscription) {
      if (clientSeed.status === SubscriptionStatus.ACTIVE || clientSeed.status === SubscriptionStatus.EXPIRED) {
        await prisma.payment.create({
          data: {
            userId: user.id,
            planId: clientSeed.planId,
            subscriptionId: subscription.id,
            resellerId,
            amount: getPlanPrice(clientSeed.planId, plans),
            status: PaymentStatus.APPROVED,
            mpStatus: 'approved',
            mpPaymentId: `MP-${user.id.slice(0, 8).toUpperCase()}`,
            paidAt: startsAt,
            expiresAt: addDays(startsAt, getPlanDurationDays(clientSeed.planId, plans)),
            createdAt: startsAt,
            updatedAt: startsAt,
          },
        })
      }

      if (clientSeed.status === SubscriptionStatus.PENDING_PAYMENT) {
        await prisma.payment.create({
          data: {
            userId: user.id,
            planId: clientSeed.planId,
            resellerId,
            amount: getPlanPrice(clientSeed.planId, plans),
            status: PaymentStatus.PENDING,
            mpStatus: 'pending',
            pixCode: 'PIX_CODE_MOCK_00020126330014BR.GOV.BCB.PIX',
            expiresAt: addDays(new Date(), 1),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      }
    }

    clientCount += 1
  }

  return {
    resellerCount: resellersData.length,
    clientCount,
  }
}

function getPlanDurationDays(
  planId: string,
  plans: { basico: Plan; premium: Plan; familia: Plan; anualPremium: Plan; trimestral: Plan },
) {
  return Object.values(plans).find(plan => plan.id === planId)?.durationDays || 30
}

function getPlanPrice(
  planId: string,
  plans: { basico: Plan; premium: Plan; familia: Plan; anualPremium: Plan; trimestral: Plan },
) {
  return Object.values(plans).find(plan => plan.id === planId)?.price || 0
}

async function main() {
  const mode = getSeedMode()
  console.log(`Seeding mode: ${mode}`)

  const categoriesCount = await seedCategories()
  const { count: plansCount, plans } = await seedPlans()
  const configsCount = await seedSystemConfig(plans.basico.id)
  const admin = await seedAdmin(mode)

  if (mode === 'production') {
    console.log('')
    console.log('Production seed completed successfully.')
    console.log(`Categories: ${categoriesCount}`)
    console.log(`Plans: ${plansCount}`)
    console.log(`System configs: ${configsCount}`)
    console.log(`Admin ready: ${admin.email}`)
    console.log('')
    console.log('No demo users, payouts or mock clients were created.')
    return
  }

  const demo = await seedDevelopmentDemo(plans)
  console.log('')
  console.log('Development seed completed successfully.')
  console.log(`Categories: ${categoriesCount}`)
  console.log(`Plans: ${plansCount}`)
  console.log(`System configs: ${configsCount}`)
  console.log(`Admin: ${admin.email} / ${admin.password}`)
  console.log(`Resellers: ${demo.resellerCount}`)
  console.log(`Clients: ${demo.clientCount}`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
