import React from 'react'
import { SupportTicketModal } from './SupportTicketModal'

export function SupportChatModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <SupportTicketModal isOpen={isOpen} onClose={onClose} />
}

export { SupportTicketModal }
