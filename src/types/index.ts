// ─────────────────────────────────────────────────────────────────────────────
// Global TypeScript types for StreamBox Pro
// ─────────────────────────────────────────────────────────────────────────────

import type { DefaultSession, DefaultUser } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

// ── NextAuth augmentation ─────────────────────────────────────────────────────
declare module 'next-auth' {
  interface Session {
    user: {
      id:            string
      role:          UserRole
      referralCode?: string | null
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role:          UserRole
    referralCode?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id:            string
    role:          UserRole
    referralCode?: string | null
  }
}

// ── Application enums ──────────────────────────────────────────────────────────
export type UserRole         = 'ADMIN' | 'RESELLER' | 'CLIENT'
export type SubStatus        = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'TRIAL' | 'PENDING_PAYMENT'
export type PaymentStatus    = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
export type PlanInterval     = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'

// ── Channel content types ──────────────────────────────────────────────────────
export type ContentType = 'LIVE' | 'MOVIE' | 'SERIES' | 'RADIO'

export interface ChannelItem {
  uuid:        string
  name:        string
  tvgName?:    string | null
  logoUrl?:    string | null
  isFeatured?: boolean
  viewCount?:  number
  contentType?: ContentType
}

export interface CategoryWithChannels {
  id:       string
  name:     string
  slug:     string
  icon?:    string | null
  channels: ChannelItem[]
}

// ── Series / VOD types ──────────────────────────────────────────────────────────

export interface SeriesItem {
  id:          string
  title:       string
  slug:        string
  posterUrl?:  string | null
  provider?:   string | null
  genre?:      string | null
  year?:       number | null
  seasonCount: number
  episodeCount: number
}

export interface SeasonItem {
  id:           string
  seasonNumber: number
  title?:       string | null
  posterUrl?:   string | null
  episodes:     EpisodeItem[]
}

export interface EpisodeItem {
  id:            string
  episodeNumber: number
  title?:        string | null
  logoUrl?:      string | null
  channelUuid:   string  // for playback
}

export interface SeriesDetail {
  id:          string
  title:       string
  slug:        string
  posterUrl?:  string | null
  backdropUrl?:string | null
  description?:string | null
  provider?:   string | null
  genre?:      string | null
  year?:       number | null
  seasons:     SeasonItem[]
}

// ── API response types ─────────────────────────────────────────────────────────
export interface ApiError {
  error: string
  debug?: string
}

export interface PaginatedResponse<T> {
  data:    T[]
  total:   number
  page:    number
  limit:   number
  hasMore: boolean
}

// ── Plan / subscription ────────────────────────────────────────────────────────
export interface Plan {
  id:           string
  name:         string
  description?: string | null
  price:        number
  interval:     PlanInterval
  durationDays: number
  maxDevices:   number
  active:       boolean
  featured:     boolean
}

export interface Subscription {
  id:        string
  status:    SubStatus
  startsAt:  string
  expiresAt: string
  plan:      Plan
  payment?:  { status: PaymentStatus; paidAt?: string | null; amount: number } | null
}
