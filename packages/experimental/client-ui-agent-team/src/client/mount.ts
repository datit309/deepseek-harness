/** Source-safe Agent Teams browser registration. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { TeamAction, type TeamActionInjected } from './TeamAction.tsx'
import { en, NS, zh, type TeamKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Agent Teams roster and task-board copy. */
    'agent-team': TeamKey
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Right sidebar navigation face. */
    sidebarRight?: {
      openTabIn: (sessionId: SessionId, kind: string, options?: { params?: { url?: string } }) => void
      openTab: (kind: string, options?: { params?: { url?: string } }) => void
    }
  }
}

interface CustomSessionEvent extends Event {
  readonly detail?: { readonly sessionId?: SessionId }
}

/** Required browser services for navigation, slots, and localized copy. */
export const inject = ['sessions', 'uiWorkspace', 'slots', 'locale', 'sidebarRight']

/**
 * Register the Team locale dictionaries and the conversation-header action.
 * The panel reads the Lead Session's `agentTeam` projection from the shared
 * Session store; this registration performs no Team RPC.
 * @param ctx - Client Context carrying the injected navigation, locale, slot, and Session services.
 */
export function registerAgentTeamUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'client-ui-agent-team: dictionaries')
  const sessions = ctx.sessions
  const leadSessionId = (sessionId: SessionId): SessionId => {
    const address = sessions.binding(sessionId)?.session.getSnapshot().subagent?.address
    return address?.parentSessionId ?? sessionId
  }

  const actions: TeamActionInjected = {
    openTeammate(sessionId: SessionId, childSessionId: SessionId): void {
      const parentSessionId = leadSessionId(sessionId)
      if ((sessions.retainInfo(sessionId).getSnapshot().retainedBy.mainView ?? 0) === 0) return
      if (childSessionId === parentSessionId) {
        ctx.uiWorkspace.openSession(parentSessionId)
        return
      }
      ctx.uiWorkspace.openSession({
        parentSessionId,
        childSessionId,
        mode: 'continuable',
      })
    },
    openSidebar(sessionId: SessionId): void {
      const host = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : '127.0.0.1'
      const url = `http://${host}:3333/?sessionId=${encodeURIComponent(sessionId)}`
      const right = ctx.sidebarRight
      if (right) {
        try {
          right.openTabIn(sessionId, 'browser', { params: { url } })
          return
        } catch (e) {
          console.warn('sidebarRight.openTabIn failed, falling back to openTab:', e)
          try {
            right.openTab('browser', { params: { url } })
            return
          } catch {}
        }
      }
      if (typeof window !== 'undefined') {
        window.open(url, '_blank')
      }
    },
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('supergraph:team:open', (e: Event) => {
      const customEvent = e as CustomSessionEvent
      const sid = customEvent.detail?.sessionId
      if (sid && actions.openSidebar) {
        actions.openSidebar(sid)
      }
    })
  }

  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'agent-team',
      order: -20,
      locale: NS,
      inject: () => actions,
    }, TeamAction),
  )
}
