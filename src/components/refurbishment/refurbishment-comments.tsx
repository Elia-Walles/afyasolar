"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, MessageCircle, Send } from "lucide-react"
import { formatDateTime, cn } from "@/lib/utils"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface RefurbishmentComment {
  id: string
  refurbishmentJobId: string
  authorId: string
  authorName: string
  authorRole: 'admin' | 'technician'
  message: string
  createdAt: Date | string
}

interface RefurbishmentCommentsProps {
  jobId: string
  role: 'admin' | 'technician'
}

export function RefurbishmentComments({ jobId, role }: RefurbishmentCommentsProps) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const { data: comments = [], isLoading } = useQuery<RefurbishmentComment[]>({
    queryKey: ['refurbishment-comments', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/refurbishments/${jobId}/comments`)
      if (!res.ok) throw new Error('Failed to fetch comments')
      const data = await res.json()
      return data.data || []
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  })

  const createComment = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/refurbishments/${jobId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) throw new Error('Failed to create comment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refurbishment-comments', jobId] })
      setMessage('')
    },
  })

  const handleSubmit = async () => {
    if (!message.trim()) return
    try {
      await createComment.mutateAsync(message.trim())
    } catch (error) {
      console.error('Error creating comment:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl px-4 py-2.5 border border-emerald-100">
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        <span>Communication Channel</span>
        <span className="text-xs text-gray-500 ml-auto">
          {role === 'admin' ? 'Admin ↔ Technician' : 'Technician ↔ Admin'}
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading messages...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            <MessageCircle className="h-6 w-6 mx-auto mb-2 text-gray-400" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          comments.map((comment) => {
            const isAdmin = comment.authorRole === 'admin'
            const isOwn = comment.authorId === (typeof window !== 'undefined' ? localStorage.getItem('userId') : null)
            
            return (
              <div
                key={comment.id}
                className={cn(
                  "rounded-lg p-3 text-sm space-y-1 transition-all hover:shadow-sm",
                  isAdmin
                    ? "bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200"
                    : "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold text-xs px-2 py-0.5 rounded-full",
                      isAdmin
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}>
                      {isAdmin ? 'Admin' : 'Technician'}
                    </span>
                    <span className="font-medium text-gray-800">{comment.authorName}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="text-gray-700 leading-relaxed">{comment.message}</p>
              </div>
            )
          })
        )}
      </div>

      <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-4 shadow-sm">
        <Textarea
          placeholder={`Type a message to ${role === 'admin' ? 'the technician' : 'admin'}...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="text-sm bg-white focus:bg-white border-emerald-200 focus:border-emerald-400 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit()
            }
          }}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            onClick={handleSubmit}
            disabled={createComment.isPending || !message.trim()}
          >
            {createComment.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3 w-3 mr-1.5" />
                Send Message
              </>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">
          Press Cmd/Ctrl + Enter to send
        </p>
      </div>
    </div>
  )
}

