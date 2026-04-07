"use client"

import { useEffect, useMemo, useState } from "react"
import { useMaintenanceComments, useCreateMaintenanceComment, type MaintenanceComment } from "@/hooks/use-maintenance"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MessageCircle } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

interface RequestCommentsProps {
  requestId: string
  role: 'admin' | 'technician' | 'facility'
}

export function RequestComments({ requestId, role }: RequestCommentsProps) {
  const { data: comments = [], isLoading } = useMaintenanceComments(requestId)
  const createComment = useCreateMaintenanceComment()
  
  // Debug logging
  useEffect(() => {
    console.log('[RequestComments] RequestId:', requestId)
    console.log('[RequestComments] Comments:', comments)
    console.log('[RequestComments] IsLoading:', isLoading)
  }, [requestId, comments, isLoading])
  const visibilityOptions = useMemo(() => {
    if (role === 'admin') {
      return [
        { value: 'internal', label: 'Admins only' },
        { value: 'facility', label: 'Admins + facility' },
        { value: 'technician', label: 'Admins + technician' },
        { value: 'public', label: 'Visible to everyone' },
      ] as const
    }
    if (role === 'technician') {
      return [
        { value: 'technician', label: 'Send to admin' },
        { value: 'public', label: 'Share with everyone' },
      ] as const
    }
    return [
      { value: 'facility', label: 'Send to admin' },
      { value: 'public', label: 'Share with everyone' },
    ] as const
  }, [role])
  const [message, setMessage] = useState('')
  const [visibility, setVisibility] = useState<
    'internal' | 'facility' | 'technician' | 'public'
  >(visibilityOptions[0].value)

  useEffect(() => {
    setVisibility(visibilityOptions[0].value)
  }, [visibilityOptions])

  const handleSubmit = async () => {
    if (!message.trim()) return
    try {
      await createComment.mutateAsync({
        requestId,
        message: message.trim(),
        visibility: visibility,
      })
      setMessage('')
    } catch (error) {
      // handled by hook
    }
  }

  const renderBadge = (comment: MaintenanceComment) => {
    if (role === 'admin') {
      return (
        <span className="text-[10px] uppercase text-gray-400">
          {comment.visibility}
        </span>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-emerald-50 rounded-xl px-3 py-2">
        <MessageCircle className="h-4 w-4 text-emerald-500" />
        Real-time Updates
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading messages...
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-gray-500">No messages yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border bg-white p-3 text-xs space-y-1">
              <div className="flex items-center justify-between text-gray-500">
                <span className="font-semibold text-gray-800">{comment.authorName}</span>
                <span>{formatDateTime(comment.createdAt)}</span>
              </div>
              <p className="text-gray-700">{comment.message}</p>
              {renderBadge(comment)}
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 rounded-2xl border bg-white p-3 shadow-sm">
        <Select
          value={visibility}
          onValueChange={(val) => setVisibility(val as typeof visibility)}
        >
          <SelectTrigger className="text-xs h-8">
            <SelectValue placeholder="Select recipients" />
          </SelectTrigger>
          <SelectContent>
            {visibilityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="text-xs bg-gray-50 focus:bg-white"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="text-xs"
            onClick={handleSubmit}
            disabled={createComment.isPending || !message.trim()}
          >
            {createComment.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

