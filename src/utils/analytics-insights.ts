import type { TemporalPattern } from '@bsky/shared'

export function generateInsights(data: {
  temporalPatterns: TemporalPattern[]
  engagementQuality: any
  contentAnalysis: any
  engagementMetrics: any
}) {
  const insights: Array<{
    icon: string
    title: string
    description: string
    priority: number
  }> = []

  // Analyze best posting times
  const bestTimes = analyzeBestPostingTimes(data.temporalPatterns)
  if (bestTimes) {
    insights.push({
      icon: '💡',
      title: 'Optimize Posting Time',
      description: bestTimes,
      priority: 1
    })
  }

  // Engagement quality insights
  if (data.engagementQuality.conversationDepth < 50) {
    insights.push({
      icon: '💬',
      title: 'Increase Conversation Depth',
      description: 'Try asking questions in your posts or creating discussion threads to boost engagement quality.',
      priority: 2
    })
  }

  // Content length insights
  if (data.contentAnalysis.avgPostLength < 100) {
    insights.push({
      icon: '📝',
      title: 'Experiment with Longer Content',
      description: `Your posts average ${data.contentAnalysis.avgPostLength} characters. Longer, more detailed posts often drive deeper engagement.`,
      priority: 3
    })
  }

  // Media usage insights
  const mediaPercentage = (data.contentAnalysis.postsWithMedia / data.contentAnalysis.totalPosts) * 100
  if (mediaPercentage < 20) {
    insights.push({
      icon: '📷',
      title: 'Add More Visual Content',
      description: `Only ${Math.round(mediaPercentage)}% of your posts include media. Posts with images typically get 2x more engagement.`,
      priority: 4
    })
  }

  // Hashtag insights
  if (data.contentAnalysis.topHashtags.length === 0) {
    insights.push({
      icon: '#️⃣',
      title: 'Start Using Hashtags',
      description: 'You\'re not using any hashtags. They can help your content reach new audiences.',
      priority: 5
    })
  }

  // Consistency insights
  if (data.engagementQuality.consistency < 70) {
    insights.push({
      icon: '📅',
      title: 'Post More Consistently',
      description: 'Your posting frequency varies. Try to maintain a regular posting schedule for better audience retention.',
      priority: 6
    })
  }

  // Network insights
  if (data.engagementQuality.networkAmplification < 30) {
    insights.push({
      icon: '🔄',
      title: 'Boost Network Amplification',
      description: 'Your content isn\'t spreading far beyond direct followers. Try creating more shareable content.',
      priority: 7
    })
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, 5)
}

function analyzeBestPostingTimes(patterns: TemporalPattern[]): string | null {
  if (patterns.length === 0) return null

  // Find the top engagement times
  const sortedByEngagement = [...patterns]
    .filter(p => p.count > 0)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 5)

  if (sortedByEngagement.length === 0) return null

  // Group by time periods
  const timeGroups = {
    morning: sortedByEngagement.filter(p => p.hour >= 6 && p.hour < 12),
    afternoon: sortedByEngagement.filter(p => p.hour >= 12 && p.hour < 17),
    evening: sortedByEngagement.filter(p => p.hour >= 17 && p.hour < 22),
    night: sortedByEngagement.filter(p => p.hour >= 22 || p.hour < 6)
  }

  // Find dominant period
  const [dominantPeriod, dominantPatterns] = Object.entries(timeGroups)
    .sort(([, a], [, b]) => b.length - a.length)[0]

  // Find best days
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const bestDays = new Set(dominantPatterns.map(p => dayNames[p.dayOfWeek]))
  
  if (bestDays.size === 0) return null

  const dayList = Array.from(bestDays).join(', ')
  const hourRange = dominantPatterns.length > 0 
    ? `${Math.min(...dominantPatterns.map(p => p.hour))}-${Math.max(...dominantPatterns.map(p => p.hour)) + 1}`
    : ''

  return `Your audience is most active on ${dayList} during ${dominantPeriod} hours (${hourRange}:00). Try scheduling important posts during these times.`
}