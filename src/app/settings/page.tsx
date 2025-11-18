"use client"

import { AppLayout } from "../../../components/app-layout"
import { Button } from "../../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Switch } from "../../../components/ui/switch"
import { Label } from "../../../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { useToast } from "../../../hooks/use-toast"
import { CheckCircle2, LinkIcon } from "lucide-react"
import { useState } from "react"

export default function SettingsPage() {
  const [figmaConnected, setFigmaConnected] = useState(true)
  const [slackConnected, setSlackConnected] = useState(false)
  const [linearConnected, setLinearConnected] = useState(false)
  const [autoValidate, setAutoValidate] = useState(true)
  const [piiRedaction, setPiiRedaction] = useState(true)
  const { toast } = useToast()

  const handleConnect = (service: string) => {
    toast({
      title: `${service} connected`,
      description: `Successfully connected to ${service}`,
    })
    if (service === "Slack") setSlackConnected(true)
    if (service === "Linear") setLinearConnected(true)
  }

  return (
    <AppLayout>

      <main className="container mx-auto p-6 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your integrations, policies, and preferences</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect external services to enhance your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Figma</p>
                    <p className="text-sm text-muted-foreground">Import prototypes and designs</p>
                  </div>
                </div>
                {figmaConnected ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <Button onClick={() => handleConnect("Figma")}>Connect</Button>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Slack</p>
                    <p className="text-sm text-muted-foreground">Send findings to your team</p>
                  </div>
                </div>
                {slackConnected ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <Button onClick={() => handleConnect("Slack")}>Connect</Button>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Linear</p>
                    <p className="text-sm text-muted-foreground">Create issues from findings</p>
                  </div>
                </div>
                {linearConnected ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                ) : (
                  <Button onClick={() => handleConnect("Linear")}>Connect</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Policies</CardTitle>
              <CardDescription>Configure validation and enforcement rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoValidate">Auto-validate High-impact Findings</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically validate high-severity findings with human micro-tests
                  </p>
                </div>
                <Switch id="autoValidate" checked={autoValidate} onCheckedChange={setAutoValidate} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <CardDescription>Manage data privacy and retention settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="piiRedaction">PII Redaction</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically redact personal information from test results
                  </p>
                </div>
                <Switch id="piiRedaction" checked={piiRedaction} onCheckedChange={setPiiRedaction} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retention">Data Retention Window</Label>
                <Select defaultValue="90">
                  <SelectTrigger id="retention">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="training">Training Opt-in</Label>
                  <p className="text-sm text-muted-foreground">Allow anonymous data to improve AI models</p>
                </div>
                <Switch id="training" defaultChecked={false} />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  )
}
