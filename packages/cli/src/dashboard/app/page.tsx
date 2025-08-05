'use client'

import { useEffect, useState } from 'react'
import { MetricCard } from '@/components/metric-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AnalyticsSession, AnalyticsSummary } from '@/lib/types'

// Utility functions moved here to avoid Node.js dependencies in client
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export default function Dashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [recentSessions, setRecentSessions] = useState<AnalyticsSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch summary data
        const summaryResponse = await fetch('/api/analytics/summary?days=7')
        if (!summaryResponse.ok) throw new Error('Failed to fetch summary')
        const summaryData = await summaryResponse.json()
        setSummary(summaryData)

        // Fetch recent sessions
        const sessionsResponse = await fetch('/api/analytics?days=7')
        if (!sessionsResponse.ok) throw new Error('Failed to fetch sessions')
        const sessionsData = await sessionsResponse.json()
        setRecentSessions(sessionsData.slice(0, 10)) // Last 10 sessions

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Data Available</h2>
          <p className="text-muted-foreground">No analytics data found. Run some Vibekit sessions first!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">📊 Vibekit Analytics</h1>
        <p className="text-muted-foreground">
          Analytics dashboard for your coding agent usage (Last 7 days)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Total Sessions"
          value={summary.totalSessions}
          description="Coding agent sessions"
        />
        <MetricCard
          title="Success Rate"
          value={`${summary.successRate.toFixed(1)}%`}
          description="Sessions completed successfully"
          badge={{
            text: summary.successRate >= 80 ? "Good" : summary.successRate >= 60 ? "Fair" : "Needs Improvement",
            variant: summary.successRate >= 80 ? "default" : summary.successRate >= 60 ? "secondary" : "destructive"
          }}
        />
        <MetricCard
          title="Average Duration"
          value={formatDuration(summary.averageDuration)}
          description="Per session"
        />
        <MetricCard
          title="Files Changed"
          value={summary.totalFilesChanged}
          description="Total across all sessions"
        />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Agent Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(summary.agentBreakdown).map(([agentName, stats]) => (
                <div key={agentName} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{agentName}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {stats.sessions} session{stats.sessions !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{stats.successRate.toFixed(1)}% success</div>
                    <div className="text-xs text-muted-foreground">
                      avg {formatDuration(stats.averageDuration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.map((session) => (
                <div key={session.sessionId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{session.agentName}</Badge>
                      <Badge variant={session.exitCode === 0 ? "default" : "destructive"}>
                        {session.exitCode === 0 ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(session.startTime).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatDuration(session.duration || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.filesChanged.length} file{session.filesChanged.length !== 1 ? 's' : ''} changed
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Summary */}
      {summary.totalErrors > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Top Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.topErrors.map((error, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm font-mono">{error.error}</span>
                  <Badge variant="destructive">{error.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
