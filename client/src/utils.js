export function nextReviewLabel(dateStr) {
  if (!dateStr) return null
  const now = new Date()
  const next = new Date(dateStr)
  const diffMs = next - now
  const diffMins = Math.round(diffMs / 60000)
  const diffDays = Math.round(diffMs / 86400000)

  if (diffMins <= 1)  return 'Due now'
  if (diffMins < 60)  return `In ${diffMins} min`
  if (diffDays < 1)   return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `In ${diffDays} days`
}
