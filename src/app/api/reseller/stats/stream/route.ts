import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getResellerDashboardStats } from '@/lib/dashboard-stats'

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  if (!session || !user || !user.role || !['ADMIN', 'RESELLER'].includes(user.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const encoder = new TextEncoder()
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let interval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const payload = await getResellerDashboardStats(user.id)
          controller.enqueue(encoder.encode(`event: stats\ndata: ${JSON.stringify(payload)}\n\n`))
        } catch (error) {
          controller.enqueue(encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : 'stream_error' })}\n\n`,
          ))
        }
      }

      await send()

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`))
      }, 15000)

      interval = setInterval(() => {
        void send()
      }, 8000)
    },
    cancel() {
      if (interval) clearInterval(interval)
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
