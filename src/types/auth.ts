export interface BridgeKeyInfoFull {
  bridgeKey: string | null
  bridgeKeyId: string | null
  isHashed: boolean
  syncUrl: string
}

export interface BridgeKeyInfo {
  bridgeKey: string | null
  hasBridgeKey: boolean
}
