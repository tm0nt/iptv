import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAdminDashboardStats } from '@/lib/dashboard-stats'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const recentPage = Math.max(1, parseInt(searchParams.get('recentPage') || '1', 10))
  const recentLimit = Math.min(50, Math.max(5, parseInt(searchParams.get('recentLimit') || '10', 10)))

  const encoder = new TextEncoder()
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let interval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const payload = await getAdminDashboardStats({ recentPage, recentLimit })
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
