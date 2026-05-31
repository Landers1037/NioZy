import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getElectronAPI } from '@/lib/electron-client'
import { useP2pChatStore } from '@/stores/p2p-chat-store'

export function ChatRequestDialog() {
  const { t } = useTranslation()
  const pendingRequest = useP2pChatStore((s) => s.pendingRequest)
  const setPendingRequest = useP2pChatStore((s) => s.setPendingRequest)

  const peerName =
    pendingRequest?.peer.displayName ||
    pendingRequest?.peer.hostname ||
    t('chat.peerFallback')

  return (
    <AlertDialog
      open={pendingRequest !== null}
      onOpenChange={(open) => {
        if (!open && pendingRequest) {
          void getElectronAPI()
            .p2p.rejectRequest(pendingRequest.requestId)
            .finally(() => setPendingRequest(null))
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('chat.requestTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingRequest &&
              t('chat.requestDesc', {
                name: peerName,
                ip: pendingRequest.peer.ip,
                port: pendingRequest.peer.port,
              })}
            {pendingRequest?.message ? (
              <span className="mt-2 block">
                {t('chat.requestMessage', { message: pendingRequest.message })}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (!pendingRequest) return
              void getElectronAPI()
                .p2p.rejectRequest(pendingRequest.requestId)
                .finally(() => setPendingRequest(null))
            }}
          >
            {t('chat.reject')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!pendingRequest) return
              void getElectronAPI()
                .p2p.acceptRequest(pendingRequest.requestId)
                .then((result) => {
                  if (!result.ok) toast.error(result.error ?? t('toast.p2pConnectFailed'))
                })
                .finally(() => setPendingRequest(null))
            }}
          >
            {t('chat.accept')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
