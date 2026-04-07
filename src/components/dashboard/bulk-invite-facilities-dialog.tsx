"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileSpreadsheet, Mail, Plus, X, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { cn } from "@/lib/utils"

interface BulkInviteFacilitiesDialogProps {
  onSuccess?: () => void
}

interface EmailEntry {
  id: string
  email: string
  name?: string
}

export function BulkInviteFacilitiesDialog({ onSuccess }: BulkInviteFacilitiesDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"file" | "manual">("file")
  const [file, setFile] = useState<File | null>(null)
  const [emailsFromFile, setEmailsFromFile] = useState<EmailEntry[]>([])
  const [manualEmails, setManualEmails] = useState<EmailEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, failed: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (!uploadedFile) return

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
      "application/csv", // .csv
    ]
    
    const validExtensions = [".xlsx", ".xls", ".csv"]
    const fileExtension = uploadedFile.name.toLowerCase().substring(uploadedFile.name.lastIndexOf("."))
    
    if (!validTypes.includes(uploadedFile.type) && !validExtensions.includes(fileExtension)) {
      toast.error("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file")
      return
    }

    setFile(uploadedFile)
    setIsProcessing(true)

    try {
      const emails: EmailEntry[] = []

      if (fileExtension === ".csv") {
        // Parse CSV file
        const text = await uploadedFile.text()
        const lines = text.split("\n").filter(line => line.trim())
        
        // Assume first row might be header, try to detect
        const firstLine = lines[0]?.toLowerCase() || ""
        const hasHeader = firstLine.includes("email") || firstLine.includes("e-mail")
        const startIndex = hasHeader ? 1 : 0

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          // Handle CSV with quotes and commas
          const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""))
          
          // Try to find email column (could be first, second, etc.)
          let email = ""
          let name = ""

          for (const value of values) {
            if (validateEmail(value)) {
              email = value
              break
            }
          }

          // If no email found in values, try the whole line
          if (!email && validateEmail(line)) {
            email = line
          }

          // Name might be in another column
          if (values.length > 1) {
            const nameCandidate = values.find(v => v && !validateEmail(v) && v !== email)
            if (nameCandidate) {
              name = nameCandidate
            }
          }

          if (email) {
            emails.push({
              id: `file-${i}`,
              email: email.toLowerCase().trim(),
              name: name || undefined,
            })
          }
        }
      } else {
        // Parse Excel file
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (data.length === 0) {
          toast.error("The Excel file appears to be empty")
          setIsProcessing(false)
          return
        }

        // Find email column (check first row for headers)
        const firstRow = data[0] || []
        let emailColumnIndex = -1
        let nameColumnIndex = -1

        for (let i = 0; i < firstRow.length; i++) {
          const cell = String(firstRow[i] || "").toLowerCase()
          if (cell.includes("email") || cell.includes("e-mail")) {
            emailColumnIndex = i
          }
          if (cell.includes("name") || cell.includes("facility")) {
            nameColumnIndex = i
          }
        }

        // If no header row detected, assume first column is email
        const startRow = emailColumnIndex >= 0 ? 1 : 0
        if (emailColumnIndex < 0) {
          emailColumnIndex = 0
        }

        for (let i = startRow; i < data.length; i++) {
          const row = data[i] || []
          const emailValue = String(row[emailColumnIndex] || "").trim()
          
          if (emailValue && validateEmail(emailValue)) {
            const nameValue = nameColumnIndex >= 0 ? String(row[nameColumnIndex] || "").trim() : ""
            emails.push({
              id: `file-${i}`,
              email: emailValue.toLowerCase(),
              name: nameValue || undefined,
            })
          }
        }
      }

      if (emails.length === 0) {
        toast.error("No valid email addresses found in the file")
        setIsProcessing(false)
        return
      }

      // Remove duplicates
      const uniqueEmails = emails.filter((email, index, self) =>
        index === self.findIndex((e) => e.email === email.email)
      )

      setEmailsFromFile(uniqueEmails)
      toast.success(`Found ${uniqueEmails.length} unique email address(es) in the file`)
    } catch (error: any) {
      console.error("Error parsing file:", error)
      toast.error(`Failed to parse file: ${error.message || "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const addManualEmail = () => {
    const newEntry: EmailEntry = {
      id: `manual-${Date.now()}-${Math.random()}`,
      email: "",
    }
    setManualEmails([...manualEmails, newEntry])
  }

  const updateManualEmail = (id: string, email: string, name?: string) => {
    setManualEmails(manualEmails.map(entry =>
      entry.id === id ? { ...entry, email: email.trim(), name: name?.trim() } : entry
    ))
  }

  const removeManualEmail = (id: string) => {
    setManualEmails(manualEmails.filter(entry => entry.id !== id))
  }

  const removeFileEmail = (id: string) => {
    setEmailsFromFile(emailsFromFile.filter(entry => entry.id !== id))
  }

  const getAllEmails = (): EmailEntry[] => {
    const all = [...emailsFromFile, ...manualEmails]
    // Remove duplicates and invalid emails
    const valid = all.filter(entry => entry.email && validateEmail(entry.email))
    const unique = valid.filter((entry, index, self) =>
      index === self.findIndex((e) => e.email === entry.email)
    )
    return unique
  }

  const handleBulkInvite = async () => {
    const allEmails = getAllEmails()

    if (allEmails.length === 0) {
      toast.error("Please add at least one valid email address")
      return
    }

    setIsSending(true)
    setSendProgress({ sent: 0, total: allEmails.length, failed: 0 })

    try {
      const response = await fetch("/api/admin/facilities/bulk-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: allEmails.map(e => ({
            email: e.email,
            name: e.name || e.email.split("@")[0], // Use email prefix as default name
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitations")
      }

      const { sent, failed, errors } = data

      setSendProgress({
        sent: sent || 0,
        total: allEmails.length,
        failed: failed || 0,
      })

      if (failed > 0 && errors && errors.length > 0) {
        const errorMessages = errors.map((e: any) => `${e.email}: ${e.error}`).join("\n")
        toast.warning(
          `Sent ${sent} invitation(s), but ${failed} failed. ${errors.length > 0 ? `\n\nErrors:\n${errorMessages}` : ""}`,
          { 
            duration: 8000,
            description: errors.length > 3 
              ? `${errors.slice(0, 3).map((e: any) => e.email).join(", ")} and ${errors.length - 3} more...`
              : errors.map((e: any) => e.email).join(", ")
          }
        )
        console.error("Invitation errors:", errors)
      } else if (sent > 0) {
        toast.success(`Successfully sent ${sent} invitation(s)!`)
      } else {
        toast.error("No invitations were sent. Please check your SMTP configuration and try again.")
      }

      // Reset form
      setFile(null)
      setEmailsFromFile([])
      setManualEmails([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      if (onSuccess) {
        onSuccess()
      }

      // Close dialog after a short delay
      setTimeout(() => {
        setOpen(false)
        setSendProgress({ sent: 0, total: 0, failed: 0 })
      }, 2000)
    } catch (error: any) {
      console.error("Error sending bulk invitations:", error)
      toast.error(error.message || "Failed to send invitations. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  const totalEmails = getAllEmails().length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Bulk Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bulk Invite Facilities
          </DialogTitle>
          <DialogDescription>
            Send invitation emails to multiple facilities at once. You can upload an Excel/CSV file or add emails manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "file" | "manual")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Plus className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Upload Excel or CSV File</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="flex-1"
                />
                {file && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFile(null)
                      setEmailsFromFile([])
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ""
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: .xlsx, .xls, .csv. The file should contain email addresses in a column.
              </p>
            </div>

            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing file...
              </div>
            )}

            {emailsFromFile.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Emails from File ({emailsFromFile.length})</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmailsFromFile([])}
                    className="h-7 text-xs"
                  >
                    Clear All
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                  {emailsFromFile.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{entry.email}</div>
                        {entry.name && (
                          <div className="text-xs text-muted-foreground truncate">{entry.name}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFileEmail(entry.id)}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Add Email Addresses</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addManualEmail}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Email
                </Button>
              </div>
            </div>

            {manualEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click "Add Email" to start adding email addresses</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {manualEmails.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 p-2 border rounded-md">
                    <Input
                      type="email"
                      placeholder="facility@example.com"
                      value={entry.email}
                      onChange={(e) => updateManualEmail(entry.id, e.target.value, entry.name)}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      placeholder="Facility Name (optional)"
                      value={entry.name || ""}
                      onChange={(e) => updateManualEmail(entry.id, entry.email, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeManualEmail(entry.id)}
                      className="h-9 w-9 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary */}
        {totalEmails > 0 && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-900">
                  Ready to send {totalEmails} invitation{totalEmails !== 1 ? "s" : ""}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {emailsFromFile.length > 0 && `${emailsFromFile.length} from file`}
                  {emailsFromFile.length > 0 && manualEmails.length > 0 && " + "}
                  {manualEmails.length > 0 && `${manualEmails.length} manual`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isSending && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-green-600" />
              <span className="text-sm font-medium text-green-900">
                Sending invitations... ({sendProgress.sent}/{sendProgress.total})
              </span>
            </div>
            {sendProgress.failed > 0 && (
              <div className="text-xs text-red-600 mt-1">
                {sendProgress.failed} failed
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkInvite}
            disabled={totalEmails === 0 || isSending}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send {totalEmails > 0 && `${totalEmails} `}Invitation{totalEmails !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
