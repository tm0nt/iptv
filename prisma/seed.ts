import {
  PrismaClient,
  PlanInterval,
  Role,
  SubscriptionStatus,
  PaymentStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── helpers ────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function subDays(date: Date, days: number) {
  return addDays(date, -days)
}

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed completo...\n')

  // ── 1. Categorias ──────────────────────────────────────────────────────────
  const categoriesData = [
    { name: 'TV Aberta',      slug: 'tv-aberta',      icon: '📺', order: 1  },
    { name: 'TV Fechada',     slug: 'tv-fechada',      icon: '📡', order: 2  },
    { name: 'Esportes',       slug: 'esportes',        icon: '⚽', order: 5  },
    { name: 'Notícias',       slug: 'noticias',        icon: '📰', order: 6  },
    { name: 'Infantil',       slug: 'infantil',        icon: '🧸', order: 7  },
    { name: 'Documentários',  slug: 'documentarios',   icon: '🌍', order: 8  },
    { name: 'Música',         slug: 'musica',          icon: '🎵', order: 9  },
    { name: 'Séries',         slug: 'series',          icon: '🎬', order: 10 },
    { name: 'Filmes',         slug: 'filmes',          icon: '🎥', order: 20 },
    { name: 'Variedades',     slug: 'variedades',      icon: '🎭', order: 11 },
    { name: 'Internacional',  slug: 'internacional',   icon: '🌎', order: 15 },
    { name: 'Religioso',      slug: 'religioso',       icon: '✝️', order: 16 },
  ]

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where:  { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, order: cat.order, active: true },
      create: cat,
    })
  }
  console.log(`  ✅ ${categoriesData.length} categorias`)

  // ── 2. Planos ──────────────────────────────────────────────────────────────
  const plansData = [
    {
      id: 'basico',
      name: 'Básico',
      description: '1 tela simultânea · SD/HD',
      price: 19.9,
      interval: PlanInterval.MONTHLY,
      durationDays: 30,
      maxDevices: 1,
      featured: false,
    },
    {
      id: 'premium',
      name: 'Premium',
      description: '2 telas simultâneas · Full HD',
      price: 29.9,
      interval: PlanInterval.MONTHLY,
      durationDays: 30,
      maxDevices: 2,
      featured: true,
    },
    {
      id: 'familia',
      name: 'Família',
      description: '4 telas simultâneas · Full HD · 4K',
      price: 49.9,
      interval: PlanInterval.MONTHLY,
      durationDays: 30,
      maxDevices: 4,
      featured: false,
    },
    {
      id: 'anual-premium',
      name: 'Anual Premium',
      description: '2 telas · Full HD · Economize 20%',
      price: 287.0,
      interval: PlanInterval.ANNUAL,
      durationDays: 365,
      maxDevices: 2,
      featured: false,
    },
    {
      id: 'trimestral',
      name: 'Trimestral',
      description: '2 telas · Full HD · 3 meses',
      price: 79.9,
      interval: PlanInterval.QUARTERLY,
      durationDays: 90,
      maxDevices: 2,
      featured: false,
    },
  ]

  for (const plan of plansData) {
    await prisma.plan.upsert({
      where:  { id: plan.id },
      update: { ...plan, active: true },
      create: { ...plan, active: true },
    })
  }
  console.log(`  ✅ ${plansData.length} planos`)

  const plans = {
    basico:       await prisma.plan.findUniqueOrThrow({ where: { id: 'basico'       } }),
    premium:      await prisma.plan.findUniqueOrThrow({ where: { id: 'premium'      } }),
    familia:      await prisma.plan.findUniqueOrThrow({ where: { id: 'familia'      } }),
    anualPremium: await prisma.plan.findUniqueOrThrow({ where: { id: 'anual-premium'} }),
    trimestral:   await prisma.plan.findUniqueOrThrow({ where: { id: 'trimestral'   } }),
  }

  // ── 3. Admin ───────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where:  { email: 'admin@streambox.pro' },
    update: { name: 'Administrador', password: await bcrypt.hash('admin123', 12), role: Role.ADMIN, active: true },
    create: {
      name:     'Administrador',
      email:    'admin@streambox.pro',
      password: await bcrypt.hash('admin123', 12),
      role:     Role.ADMIN,
      active:   true,
    },
  })
  console.log(`  ✅ Admin  → admin@streambox.pro / admin123`)

  // ── 4. Revendedores ────────────────────────────────────────────────────────
  const resellersData = [
    {
      name:           'Carlos Revendedor',
      email:          'carlos@revenda.com',
      password:       'carlos123',
      referralCode:   'CARLOS2024',
      commissionRate: 0.25,
      planId:         plans.premium.id,
    },
    {
      name:           'Fernanda Distribuidora',
      email:          'fernanda@distribuidora.com',
      password:       'fernanda123',
      referralCode:   'FERNANDA10',
      commissionRate: 0.30,
      planId:         plans.anualPremium.id,
    },
  ]

  const resellers: Array<{ id: string; commissionRate: number; referralCode: string | null }> = []

  for (const r of resellersData) {
    const hashed = await bcrypt.hash(r.password, 12)
    const reseller = await prisma.user.upsert({
      where:  { email: r.email },
      update: {
        name:           r.name,
        password:       hashed,
        role:           Role.RESELLER,
        active:         true,
        referralCode:   r.referralCode,
        commissionRate: r.commissionRate,
      },
      create: {
        name:           r.name,
        email:          r.email,
        password:       hashed,
        role:           Role.RESELLER,
        active:         true,
        referralCode:   r.referralCode,
        commissionRate: r.commissionRate,
      },
    })

    // Subscription do próprio revendedor
    const existing = await prisma.subscription.findFirst({
      where: { userId: reseller.id, planId: r.planId },
    })
    if (!existing) {
      await prisma.subscription.create({
        data: {
          userId:    reseller.id,
          planId:    r.planId,
          status:    SubscriptionStatus.ACTIVE,
          startsAt:  new Date(),
          expiresAt: addDays(new Date(), 365),
          autoRenew: true,
          username:  reseller.email,
          password:  r.password,
        },
      })
    }

    // AffiliateClicks mockados (30–60 cliques, alguns convertidos)
    const totalClicks = randBetween(30, 60)
    for (let i = 0; i < totalClicks; i++) {
      await prisma.affiliateClick.create({
        data: {
          resellerId: reseller.id,
          ipAddress:  `192.168.${randBetween(1, 254)}.${randBetween(1, 254)}`,
          userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          converted:  Math.random() < 0.35, // 35% taxa de conversão
          createdAt:  subDays(new Date(), randBetween(0, 60)),
        },
      })
    }

    // Payouts já pagos
    for (let m = 1; m <= 3; m++) {
      await prisma.payout.create({
        data: {
          resellerId: reseller.id,
          amount:     parseFloat((randBetween(150, 600)).toFixed(2)),
          status:     'PAID',
          reference:  `PAY-${reseller.id.slice(0, 6).toUpperCase()}-M${m}`,
          paidAt:     subDays(new Date(), m * 30),
          createdAt:  subDays(new Date(), m * 30 + 5),
        },
      })
    }

    // Payout pendente do mês atual
    await prisma.payout.create({
      data: {
        resellerId: reseller.id,
        amount:     parseFloat((randBetween(200, 500)).toFixed(2)),
        status:     'PENDING',
        reference:  `PAY-${reseller.id.slice(0, 6).toUpperCase()}-ATUAL`,
        createdAt:  new Date(),
      },
    })

    resellers.push({
      id:             reseller.id,
      commissionRate: r.commissionRate,
      referralCode:   r.referralCode,
    })
  }

  console.log(`  ✅ ${resellersData.length} revendedores (com cliques, conversões e payouts)`)

  // ── 5. Clientes ────────────────────────────────────────────────────────────

  const clientsData = [
    // Clientes ativos — plano premium, via revendedor Carlos
    { name: 'Ana Silva',        email: 'ana@email.com',       password: 'ana123',     planId: plans.premium.id,      status: SubscriptionStatus.ACTIVE,          daysOffset: -5,  reseller: 0 },
    { name: 'Bruno Souza',      email: 'bruno@email.com',     password: 'bruno123',   planId: plans.familia.id,       status: SubscriptionStatus.ACTIVE,          daysOffset: -10, reseller: 0 },
    { name: 'Carla Mendes',     email: 'carla@email.com',     password: 'carla123',   planId: plans.basico.id,        status: SubscriptionStatus.ACTIVE,          daysOffset: -2,  reseller: 0 },
    { name: 'Diego Pereira',    email: 'diego@email.com',     password: 'diego123',   planId: plans.trimestral.id,    status: SubscriptionStatus.ACTIVE,          daysOffset: -15, reseller: 0 },
    { name: 'Elisa Costa',      email: 'elisa@email.com',     password: 'elisa123',   planId: plans.anualPremium.id,  status: SubscriptionStatus.ACTIVE,          daysOffset: -30, reseller: 0 },

    // Clientes via revendedora Fernanda
    { name: 'Fábio Lima',       email: 'fabio@email.com',     password: 'fabio123',   planId: plans.premium.id,       status: SubscriptionStatus.ACTIVE,          daysOffset: -7,  reseller: 1 },
    { name: 'Gisele Oliveira',  email: 'gisele@email.com',    password: 'gisele123',  planId: plans.familia.id,       status: SubscriptionStatus.ACTIVE,          daysOffset: -20, reseller: 1 },
    { name: 'Hugo Ferreira',    email: 'hugo@email.com',      password: 'hugo123',    planId: plans.basico.id,        status: SubscriptionStatus.ACTIVE,          daysOffset: -1,  reseller: 1 },
    { name: 'Isabela Santos',   email: 'isabela@email.com',   password: 'isabela123', planId: plans.trimestral.id,    status: SubscriptionStatus.ACTIVE,          daysOffset: -45, reseller: 1 },
    { name: 'João Martins',     email: 'joao@email.com',      password: 'joao123',    planId: plans.anualPremium.id,  status: SubscriptionStatus.ACTIVE,          daysOffset: -60, reseller: 1 },

    // Clientes sem revendedor (direto)
    { name: 'Kátia Rocha',      email: 'katia@email.com',     password: 'katia123',   planId: plans.premium.id,       status: SubscriptionStatus.ACTIVE,          daysOffset: -3,  reseller: null },
    { name: 'Lucas Barbosa',    email: 'lucas@email.com',     password: 'lucas123',   planId: plans.basico.id,        status: SubscriptionStatus.ACTIVE,          daysOffset: -8,  reseller: null },
    { name: 'Mariana Alves',    email: 'mariana@email.com',   password: 'mariana123', planId: plans.familia.id,       status: SubscriptionStatus.ACTIVE,          daysOffset: -12, reseller: null },

    // Clientes expirados
    { name: 'Natan Cruz',       email: 'natan@email.com',     password: 'natan123',   planId: plans.basico.id,        status: SubscriptionStatus.EXPIRED,         daysOffset: -35, reseller: 0 },
    { name: 'Olívia Dias',      email: 'olivia@email.com',    password: 'olivia123',  planId: plans.premium.id,       status: SubscriptionStatus.EXPIRED,         daysOffset: -65, reseller: 1 },

    // Clientes em trial / pendente
    { name: 'Paulo Cardoso',    email: 'paulo@email.com',     password: 'paulo123',   planId: plans.basico.id,        status: SubscriptionStatus.TRIAL,           daysOffset: 0,   reseller: null },
    { name: 'Queila Freitas',   email: 'queila@email.com',    password: 'queila123',  planId: plans.premium.id,       status: SubscriptionStatus.PENDING_PAYMENT, daysOffset: 0,   reseller: null },
  ]

  let clientCount = 0

  for (const c of clientsData) {
    const hashed = await bcrypt.hash(c.password, 12)
    const client = await prisma.user.upsert({
      where:  { email: c.email },
      update: { name: c.name, password: hashed, role: Role.CLIENT, active: true },
      create: { name: c.name, email: c.email, password: hashed, role: Role.CLIENT, active: true },
    })

    const plan        = plansData.find(p => p.id === c.planId)!
    const createdAt   = subDays(new Date(), Math.abs(c.daysOffset))
    const startsAt    = createdAt
    const isExpired   = c.status === SubscriptionStatus.EXPIRED
    const expiresAt   = isExpired
      ? subDays(new Date(), 5)                       // expirou há 5 dias
      : addDays(startsAt, plan.durationDays)

    const resellerId = c.reseller !== null ? resellers[c.reseller].id : null

    // Subscription
    const existingSub = await prisma.subscription.findFirst({
      where: { userId: client.id, planId: c.planId },
    })

    let sub = existingSub
    if (!existingSub) {
      sub = await prisma.subscription.create({
        data: {
          userId:     client.id,
          planId:     c.planId,
          status:     c.status,
          startsAt,
          expiresAt,
          autoRenew:  c.status === SubscriptionStatus.ACTIVE,
          username:   client.email,
          password:   c.password,
          resellerId,
          createdAt,
          updatedAt:  createdAt,
        },
      })
    }

    // Payment — apenas para ACTIVE e EXPIRED
    if (
      sub &&
      (c.status === SubscriptionStatus.ACTIVE || c.status === SubscriptionStatus.EXPIRED)
    ) {
      const existingPayment = await prisma.payment.findFirst({
        where: { userId: client.id, planId: c.planId },
      })

      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            userId:         client.id,
            planId:         c.planId,
            subscriptionId: sub.id,
            resellerId,
            amount:         plan.price,
            status:         PaymentStatus.APPROVED,
            mpStatus:       'approved',
            mpPaymentId:    `MP-${client.id.slice(0, 8).toUpperCase()}`,
            paidAt:         createdAt,
            expiresAt:      addDays(createdAt, plan.durationDays),
            createdAt,
            updatedAt:      createdAt,
          },
        })
      }
    }

    // Payment pendente para PENDING_PAYMENT
    if (sub && c.status === SubscriptionStatus.PENDING_PAYMENT) {
      const existingPayment = await prisma.payment.findFirst({
        where: { userId: client.id, planId: c.planId },
      })

      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            userId:      client.id,
            planId:      c.planId,
            resellerId,
            amount:      plan.price,
            status:      PaymentStatus.PENDING,
            mpStatus:    'pending',
            pixCode:     'PIX_CODE_MOCK_00020126330014BR.GOV.BCB.PIX',
            expiresAt:   addDays(new Date(), 1),
            createdAt:   new Date(),
            updatedAt:   new Date(),
          },
        })
      }
    }

    clientCount++
  }

  console.log(`  ✅ ${clientCount} clientes (com subscriptions e payments)`)

  // ── 6. Configs do sistema ──────────────────────────────────────────────────
  const configs = [
    { key: 'site_name',       value: 'StreamBox Pro'         },
    { key: 'default_plan_id', value: plans.basico.id          },
    { key: 'support_email',   value: 'admin@streambox.pro'    },
    { key: 'pix_key',         value: 'admin@streambox.pro'    },
    { key: 'commission_default', value: '0.20'               },
  ]

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where:  { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    })
  }
  console.log(`  ✅ ${configs.length} configs do sistema`)

  // ── Resumo ─────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════╗
║              ✨ SEED COMPLETO                        ║
╠══════════════════════════════════════════════════════╣
║  👤 ADMIN                                            ║
║     admin@streambox.pro          / admin123          ║
╠══════════════════════════════════════════════════════╣
║  🏪 REVENDEDORES                                     ║
║     carlos@revenda.com           / carlos123         ║
║       código: CARLOS2024 · comissão: 25%             ║
║     fernanda@distribuidora.com   / fernanda123       ║
║       código: FERNANDA10 · comissão: 30%             ║
╠══════════════════════════════════════════════════════╣
║  👥 CLIENTES (17 no total)                           ║
║     • 13 ACTIVE   • 2 EXPIRED                        ║
║     • 1 TRIAL     • 1 PENDING_PAYMENT                ║
║                                                      ║
║     Exemplos:                                        ║
║     ana@email.com      / ana123      (Premium)       ║
║     bruno@email.com    / bruno123    (Família)       ║
║     lucas@email.com    / lucas123    (Básico)        ║
║     paulo@email.com    / paulo123    (Trial)         ║
╚══════════════════════════════════════════════════════╝
`)
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })