export const UNLIMITED_PLAN_DEVICE_CAP = 9999
export const UNLIMITED_PLAN_EXPIRES_AT = '2099-12-31T23:59:59.000Z'

type PlanLike = {
  durationDays?: number | null
  maxDevices?: number | null
  isUnlimited?: boolean | null
  adminOnly?: boolean | null
}

export function isUnlimitedPlan(plan?: PlanLike | null) {
  return !!plan?.isUnlimited
}

export function isAdminOnlyPlan(plan?: PlanLike | null) {
  return !!plan?.adminOnly
}

export function getPlanDeviceLimit(plan?: PlanLike | null) {
  if (isUnlimitedPlan(plan)) return UNLIMITED_PLAN_DEVICE_CAP
  return Math.max(1, Number(plan?.maxDevices || 1))
}

export function getPlanDurationDays(plan?: PlanLike | null) {
  if (isUnlimitedPlan(plan)) return null
  return Math.max(1, Number(plan?.durationDays || 30))
}

export function createPlanExpiryDate(plan?: PlanLike | null, from = new Date()) {
  if (isUnlimitedPlan(plan)) {
    return new Date(UNLIMITED_PLAN_EXPIRES_AT)
  }

  const next = new Date(from)
  next.setDate(next.getDate() + getPlanDurationDays(plan)!)
  return next
}

export function getPlanDurationLabel(plan?: PlanLike | null) {
  if (isUnlimitedPlan(plan)) return 'Acesso infinito'
  return `${getPlanDurationDays(plan)} dias`
}

export function getPlanDeviceLabel(plan?: PlanLike | null) {
  if (isUnlimitedPlan(plan)) return 'Telas ilimitadas'
  const devices = getPlanDeviceLimit(plan)
  return `${devices} tela${devices > 1 ? 's' : ''}`
}

export function getPlanUpgradeRank(plan?: PlanLike | null) {
  if (isUnlimitedPlan(plan)) return Number.MAX_SAFE_INTEGER
  return getPlanDeviceLimit(plan)
}
