export type P2pSessionStatus = 'pending' | 'connected' | 'disconnected'

export interface P2pPeerInfo {
  deviceId: string
  hostname: string
  displayName: string
  ip: string
  port: number
  lastSeen: string
}

export interface P2pSessionPeer {
  deviceId: string
  hostname: string
  displayName: string
  ip: string
  port: number
}

export interface P2pSessionInfo {
  sessionId: string
  peer: P2pSessionPeer
  status: P2pSessionStatus
  isInitiator: boolean
  /** 本地已保存会话密钥（未点「断开连接」前可复用，无需重新握手） */
  hasSecureSession?: boolean
}

export type P2pMessageDirection = 'inbound' | 'outbound'
export type P2pMessageType = 'text' | 'file' | 'image'

export interface P2pChatMessage {
  id: string
  sessionId: string
  peerDeviceId: string
  direction: P2pMessageDirection
  type: P2pMessageType
  sentAt: string
  text?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  localPath?: string
  transferStatus?: 'pending' | 'transferring' | 'complete' | 'failed'
}

export interface P2pIncomingRequest {
  requestId: string
  peer: P2pSessionPeer
  message?: string
}

export interface P2pFileProgress {
  sessionId: string
  fileId: string
  transferred: number
  total: number
}

export interface P2pStatus {
  running: boolean
  port: number
  deviceId: string
  hostname: string
  displayName: string
  discoveryEnabled: boolean
  chatDirectory: string
  error?: string
}

export interface P2pResult {
  ok: boolean
  error?: string
}

export interface P2pConnectResult extends P2pResult {
  sessionId?: string
}

export interface P2pHistoryResult {
  ok: boolean
  messages: P2pChatMessage[]
  error?: string
}

export interface P2pOpenConversationResult extends P2pResult {
  session?: P2pSessionInfo
  online?: boolean
  /** 对端在线但恢复连接或密钥握手失败 */
  handshakeFailed?: boolean
}
