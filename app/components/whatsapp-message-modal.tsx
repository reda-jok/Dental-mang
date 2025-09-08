"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Send, Eye } from "lucide-react"

interface WhatsAppMessageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientName: string
  patientPhone: string
  messageType: "appointment_scheduled" | "appointment_completed" | "custom"
  prefilledMessage: string
  onSend: (message: string) => void
}

export function WhatsAppMessageModal({
  open,
  onOpenChange,
  patientName,
  patientPhone,
  messageType,
  prefilledMessage,
  onSend,
}: WhatsAppMessageModalProps) {
  const [message, setMessage] = useState(prefilledMessage)
  const [isSending, setIsSending] = useState(false)

  const handleSend = async () => {
    setIsSending(true)
    try {
      await onSend(message)
      onOpenChange(false)
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handlePreview = () => {
    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${patientPhone.replace(/\D/g, "")}?text=${encodedMessage}`
    window.open(whatsappUrl, "_blank")
  }

  const getMessageTypeLabel = () => {
    switch (messageType) {
      case "appointment_scheduled":
        return { label: "Appointment Scheduled", color: "bg-green-100 text-green-700" }
      case "appointment_completed":
        return { label: "Treatment Completed", color: "bg-blue-100 text-blue-700" }
      default:
        return { label: "Custom Message", color: "bg-gray-100 text-gray-700" }
    }
  }

  const typeInfo = getMessageTypeLabel()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Send WhatsApp Message
          </DialogTitle>
          <DialogDescription>
            Send a WhatsApp message to {patientName} at {patientPhone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
            <span className="text-sm text-gray-600">to {patientName}</span>
          </div>

          <div>
            <Label htmlFor="message">Message Content</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
              placeholder="Enter your WhatsApp message..."
            />
            <p className="text-xs text-gray-500 mt-1">Character count: {message.length} (WhatsApp limit: 4096)</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Message Preview:</h4>
            <div className="bg-white p-3 rounded border text-sm whitespace-pre-wrap">
              {message || "No message content"}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handlePreview} className="gap-2 bg-transparent">
            <Eye className="w-4 h-4" />
            Preview in WhatsApp
          </Button>
          <Button onClick={handleSend} disabled={isSending || !message.trim()} className="gap-2">
            <Send className="w-4 h-4" />
            {isSending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
