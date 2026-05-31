import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { P2pChatMessage, P2pFileProgress } from '../../../electron/shared/p2p-types'
import { getElectronAPI } from '@/lib/electron-client'
import { cn } from '@/lib/utils'

interface ChatMessageListProps {
  messages: P2pChatMessage[]
  fileProgress: Record<string, P2pFileProgress>
  /** 已有活跃会话但尚无消息时的提示；未设置则使用 selectSession */
  emptyHint?: string
}

function ChatImagePreview({ message }: { message: P2pChatMessage }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!message.localPath) return
    let cancelled = false
    void getElectronAPI()
      .files.getImagePreviewUrl(message.localPath)
      .then((result) => {
        if (!cancelled && result.ok && result.url) setUrl(result.url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [message.localPath])

  if (!url) return <span>{message.fileName}</span>
  return (
    <img
      src={url}
      alt={message.fileName ?? 'image'}
      className="max-h-48 max-w-full rounded-md object-contain"
    />
  )
}

export function ChatMessageList({ messages, fileProgress, emptyHint }: ChatMessageListProps) {
  const { t } = useTranslation()

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {emptyHint ?? t('chat.selectSession')}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((message) => {
        const outbound = message.direction === 'outbound'
        const progress = fileProgress[message.id]
        return (
          <div
            key={message.id}
            className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                outbound ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {message.type === 'text' && <p className="whitespace-pre-wrap">{message.text}</p>}
              {(message.type === 'file' || message.type === 'image') && (
                <div className="flex flex-col gap-2">
                  {message.type === 'image' && message.localPath ? (
                    <ChatImagePreview message={message} />
                  ) : (
                    <span>{message.fileName}</span>
                  )}
                  {progress && progress.total > 0 ? (
                    <span className="text-xs opacity-80">
                      {Math.round((progress.transferred / progress.total) * 100)}%
                    </span>
                  ) : null}
                  {message.transferStatus && message.transferStatus !== 'complete' ? (
                    <span className="text-xs opacity-80">{message.transferStatus}</span>
                  ) : null}
                </div>
              )}
              <time className="mt-1 block text-[10px] opacity-70">
                {new Date(message.sentAt).toLocaleString()}
              </time>
            </div>
          </div>
        )
      })}
    </div>
  )
}
