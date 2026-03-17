'use client'
import { useState } from 'react'
import { Save, Key, Globe, Percent, Loader2, Check, ShieldCheck, AlertCircle } from 'lucide-react'

export default function AdminSettings() {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [config, setConfig] = useState({
    appName:           'StreamBox Pro',
    defaultCommission: '20',
    trialDays:         '7',
    supportEmail:      'suporte@streambox.com',
    supportWhatsapp:   '',
  })

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 700))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const F = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-label">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )

  return (
    <div className="p-4 md:p-6 pt-20 md:pt-8 max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">Configurações</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Configurações gerais do sistema</p>
      </div>

      {/* General */}
      <Section title="Geral" icon={Globe}>
        <F label="Nome do Sistema">
          <input value={config.appName} onChange={e => setConfig(c => ({ ...c, appName: e.target.value }))}
            className="field-input" placeholder="StreamBox Pro" />
        </F>
        <F label="Email de Suporte">
          <input type="email" value={config.supportEmail}
            onChange={e => setConfig(c => ({ ...c, supportEmail: e.target.value }))}
            className="field-input" placeholder="suporte@seudominio.com" />
        </F>
        <F label="WhatsApp de Suporte (opcional)">
          <input value={config.supportWhatsapp}
            onChange={e => setConfig(c => ({ ...c, supportWhatsapp: e.target.value }))}
            className="field-input" placeholder="+55 11 99999-9999" />
        </F>
      </Section>

      {/* Resellers */}
      <Section title="Revendedores" icon={Percent}>
        <F label="Comissão Padrão (%)" hint="Aplicada automaticamente a novos revendedores">
          <div className="relative">
            <input type="number" value={config.defaultCommission} min="0" max="100" step="1"
              onChange={e => setConfig(c => ({ ...c, defaultCommission: e.target.value }))}
              className="field-input pr-8" />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">%</span>
          </div>
        </F>
        <F label="Dias de Trial para novos clientes">
          <input type="number" value={config.trialDays} min="0" max="30"
            onChange={e => setConfig(c => ({ ...c, trialDays: e.target.value }))}
            className="field-input" />
        </F>
      </Section>

      {/* Security */}
      <Section title="Segurança" icon={Key}>
        <div className="space-y-2">
          {[
            { label: 'Proxy de Stream',          status: true },
            { label: 'Proteção de URLs M3U8',     status: true },
            { label: 'Verificação de Assinatura', status: true },
            { label: 'Webhook Mercado Pago',       status: !!process.env.NEXT_PUBLIC_MP_CONFIGURED },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-[13px] text-muted-foreground">{item.label}</span>
              <span className={`badge ${item.status ? 'badge-green' : 'badge-amber'}`}>
                {item.status ? <><ShieldCheck className="w-3 h-3" /> Ativo</> : <><AlertCircle className="w-3 h-3" /> Verificar</>}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 bg-secondary rounded-xl p-3.5 border border-border">
          <p className="text-[12px] font-semibold text-foreground mb-1.5">Variáveis de Ambiente (.env)</p>
          <div className="space-y-1">
            {['NEXTAUTH_SECRET', 'DATABASE_URL', 'MERCADOPAGO_ACCESS_TOKEN'].map(v => (
              <p key={v} className="text-[11px] font-mono text-muted-foreground">
                <span className="text-[var(--apple-blue)]">{v}</span>=••••••••
              </p>
            ))}
          </div>
        </div>
      </Section>

      <button onClick={handleSave} disabled={saving}
        className="btn-primary py-2.5 px-5 text-[14px]">
        {saving  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
          : saved ? <><Check className="w-4 h-4" /> Salvo!</>
          : <><Save className="w-4 h-4" /> Salvar Configurações</>}
      </button>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="surface rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-[var(--apple-blue)]" />
        <span className="text-[14px] font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}
