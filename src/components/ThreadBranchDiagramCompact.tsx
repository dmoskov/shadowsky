import React, { useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, MessageCircle, Users, TrendingUp, Clock } from 'lucide-react'
import type { ThreadViewPost } from '../services/atproto/thread'

interface ThreadBranch {
  id: string
  uri: string
  author: string
  authorHandle: string
  text: string
  depth: number
  replyCount: number
  directReplyCount: number
  participantCount: number
  latestActivity: Date
  heat: number
  children: ThreadBranch[]
  parent?: ThreadBranch
  color?: string
  timeAgo: string
}

interface ThreadBranchDiagramProps {
  thread: ThreadViewPost
  currentPostUri?: string
  onNavigate: (uri: string) => void
}

interface LayoutNode {
  branch: ThreadBranch
  x: number
  y: number
  children: LayoutNode[]
  column: number
}

// More muted color palette for better readability
const BRANCH_COLORS = [
  '#60a5fa', // blue
  '#f87171', // red
  '#34d399', // green
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#f472b6', // pink
  '#2dd4bf', // teal
  '#fb923c', // orange
]

// Format time ago
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export const ThreadBranchDiagram: React.FC<ThreadBranchDiagramProps> = ({
  thread,
  currentPostUri,
  onNavigate
}) => {
  const [hoveredBranch, setHoveredBranch] = React.useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)
  
  // Build enhanced branch structure
  const branches = useMemo(() => {
    const buildBranch = (
      node: ThreadViewPost, 
      depth: number = 0, 
      parent?: ThreadBranch,
      colorIndex: number = 0
    ): ThreadBranch | null => {
      if (!node || !node.post) return null
      
      const replies = node.replies?.filter(r => r.$type === 'app.bsky.feed.defs#threadViewPost') || []
      const children: ThreadBranch[] = []
      
      // Track metrics
      const participants = new Set<string>()
      let totalReplies = 0
      let latestTime = new Date(node.post.indexedAt)
      
      const countBranchStats = (n: ThreadViewPost) => {
        participants.add(n.post.author.handle)
        totalReplies++
        const postTime = new Date(n.post.indexedAt)
        if (postTime > latestTime) latestTime = postTime
        
        if (n.replies) {
          n.replies.forEach(r => {
            if (r.$type === 'app.bsky.feed.defs#threadViewPost') {
              countBranchStats(r as ThreadViewPost)
            }
          })
        }
      }
      
      // Build children with different colors for different branches
      replies.forEach((reply, index) => {
        if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
          const replyPost = reply as ThreadViewPost
          const childColorIndex = depth === 0 ? index % BRANCH_COLORS.length : colorIndex
          const branch = buildBranch(replyPost, depth + 1, undefined, childColorIndex)
          if (branch) {
            children.push(branch)
          }
        }
      })
      
      // Count stats
      countBranchStats(node)
      
      // Calculate heat
      const timeDiff = Date.now() - latestTime.getTime()
      const hoursAgo = timeDiff / (1000 * 60 * 60)
      const heat = totalReplies / Math.max(hoursAgo, 1)
      
      const branch: ThreadBranch = {
        id: node.post.uri,
        uri: node.post.uri,
        author: node.post.author.displayName || node.post.author.handle,
        authorHandle: node.post.author.handle,
        text: (node.post.record as any)?.text || '',
        depth,
        replyCount: totalReplies,
        directReplyCount: replies.length,
        participantCount: participants.size,
        latestActivity: latestTime,
        heat,
        children,
        parent,
        color: BRANCH_COLORS[colorIndex],
        timeAgo: formatTimeAgo(new Date(node.post.indexedAt))
      }
      
      // Set parent reference for children
      children.forEach(child => child.parent = branch)
      
      return branch
    }
    
    return buildBranch(thread) || {
      id: thread.post.uri,
      uri: thread.post.uri,
      author: thread.post.author.displayName || thread.post.author.handle,
      authorHandle: thread.post.author.handle,
      text: (thread.post.record as any)?.text || '',
      depth: 0,
      replyCount: 0,
      directReplyCount: 0,
      participantCount: 1,
      latestActivity: new Date(thread.post.indexedAt),
      heat: 0,
      children: [],
      color: BRANCH_COLORS[0],
      timeAgo: formatTimeAgo(new Date(thread.post.indexedAt))
    }
  }, [thread])
  
  // Calculate compact layout
  const layoutTree = useMemo(() => {
    const NODE_HEIGHT = 32  // Much smaller
    const COLUMN_WIDTH = 24  // Tighter columns
    const START_Y = 20
    const MIN_BRANCH_GAP = 8  // Minimal gap between branches
    
    let nextY = START_Y
    let maxColumn = 0
    const occupiedColumns = new Map<number, number>()
    
    const findFreeColumn = (parentColumn: number, y: number): number => {
      // Try parent column first
      if (!occupiedColumns.has(parentColumn) || occupiedColumns.get(parentColumn)! < y - NODE_HEIGHT) {
        return parentColumn
      }
      
      // Try columns to the right
      for (let col = parentColumn + 1; col <= maxColumn + 1; col++) {
        if (!occupiedColumns.has(col) || occupiedColumns.get(col)! < y - NODE_HEIGHT) {
          return col
        }
      }
      
      return maxColumn + 1
    }
    
    const layoutBranch = (
      branch: ThreadBranch, 
      parentColumn: number = 0,
      forceY?: number
    ): LayoutNode => {
      const y = forceY || nextY
      const column = branch.depth === 0 ? 0 : findFreeColumn(parentColumn, y)
      
      if (!forceY) {
        nextY += NODE_HEIGHT + MIN_BRANCH_GAP
      }
      
      occupiedColumns.set(column, y)
      maxColumn = Math.max(maxColumn, column)
      
      const node: LayoutNode = {
        branch,
        x: column * COLUMN_WIDTH + 20,
        y,
        children: [],
        column
      }
      
      // Layout children
      branch.children.forEach((child, index) => {
        if (index > 0) nextY += MIN_BRANCH_GAP  // Add small gap between siblings
        const childNode = layoutBranch(child, column)
        node.children.push(childNode)
      })
      
      return node
    }
    
    return layoutBranch(branches)
  }, [branches])
  
  // Calculate SVG dimensions
  const svgDimensions = useMemo(() => {
    let maxX = 0
    let maxY = 0
    
    const traverse = (node: LayoutNode) => {
      maxX = Math.max(maxX, node.x + 180)  // Account for node width
      maxY = Math.max(maxY, node.y + 32)
      node.children.forEach(traverse)
    }
    
    traverse(layoutTree)
    return { width: Math.max(260, maxX + 20), height: maxY + 20 }
  }, [layoutTree])
  
  // Render compact connection
  const renderConnection = (parent: LayoutNode, child: LayoutNode) => {
    const parentX = parent.x
    const parentY = parent.y + 16  // Center of smaller node
    const childX = child.x
    const childY = child.y + 16
    
    let path: string
    
    if (parent.column === child.column) {
      // Straight line
      path = `M ${parentX} ${parentY} L ${parentX} ${childY}`
    } else {
      // Compact branch curve
      const midY = parentY + 8
      path = `M ${parentX} ${parentY} 
              L ${parentX} ${midY}
              Q ${parentX} ${childY} ${childX} ${childY}`
    }
    
    return (
      <path
        key={`${parent.branch.id}-${child.branch.id}`}
        d={path}
        stroke={child.branch.color}
        strokeWidth="2"
        fill="none"
        opacity={0.6}
      />
    )
  }
  
  // Render compact node
  const renderNode = (node: LayoutNode) => {
    const { branch, x, y } = node
    const isActive = branch.uri === currentPostUri
    const isHovered = hoveredBranch === branch.id
    
    // Calculate dynamic width based on content
    const minWidth = 120
    const maxWidth = 180
    const charWidth = 7  // Approximate character width
    const neededWidth = Math.max(
      branch.author.length * charWidth + 60,  // Author + padding
      80 + 30  // Reply count + padding
    )
    const nodeWidth = Math.min(maxWidth, Math.max(minWidth, neededWidth))
    
    return (
      <g
        key={branch.id}
        onMouseEnter={() => setHoveredBranch(branch.id)}
        onMouseLeave={() => setHoveredBranch(null)}
        onClick={() => onNavigate(branch.uri)}
        style={{ cursor: 'pointer' }}
      >
        {/* Compact dot */}
        <circle
          cx={x}
          cy={y + 16}
          r={isActive ? 5 : 4}
          fill={branch.color}
          stroke={isActive ? '#fff' : 'none'}
          strokeWidth={isActive ? 2 : 0}
        />
        
        {/* Compact node */}
        <rect
          x={x + 12}
          y={y}
          width={nodeWidth}
          height={32}
          rx={4}
          fill={isActive ? branch.color : (isHovered ? '#374151' : '#2d3748')}
          fillOpacity={isActive ? 0.2 : 1}
          stroke={branch.color}
          strokeWidth="1"
          opacity={0.9}
        />
        
        {/* Compact content */}
        <text
          x={x + 20}
          y={y + 14}
          fill={isActive ? '#fff' : '#f3f4f6'}
          fontSize="11"
          fontWeight={isActive ? '600' : '500'}
        >
          {branch.author.slice(0, 16)}{branch.author.length > 16 ? '…' : ''}
        </text>
        
        {/* Stats line */}
        <text
          x={x + 20}
          y={y + 26}
          fill="#9ca3af"
          fontSize="9"
        >
          {branch.directReplyCount > 0 && `${branch.directReplyCount} replies`}
          {branch.heat > 0.5 && ' 🔥'}
          {branch.participantCount > 2 && ` • ${branch.participantCount}p`}
          {` • ${branch.timeAgo}`}
        </text>
        
        {/* Nested indicator */}
        {branch.children.length > 0 && (
          <text
            x={x + nodeWidth + 2}
            y={y + 20}
            fill={branch.color}
            fontSize="10"
            fontWeight="bold"
          >
            ▶
          </text>
        )}
      </g>
    )
  }
  
  // Render tree recursively
  const renderTree = (node: LayoutNode): React.ReactNode[] => {
    const elements: React.ReactNode[] = []
    
    // Render connections first
    node.children.forEach(child => {
      elements.push(renderConnection(node, child))
    })
    
    // Render this node
    elements.push(renderNode(node))
    
    // Render children
    node.children.forEach(child => {
      elements.push(...renderTree(child))
    })
    
    return elements
  }
  
  // Calculate thread stats
  const threadStats = useMemo(() => {
    let totalPosts = 0
    let uniqueAuthors = new Set<string>()
    let maxDepth = 0
    let hottestBranch = { heat: 0, author: '' }
    
    const analyze = (branch: ThreadBranch, depth: number = 0) => {
      totalPosts++
      uniqueAuthors.add(branch.authorHandle)
      maxDepth = Math.max(maxDepth, depth)
      
      if (branch.heat > hottestBranch.heat) {
        hottestBranch = { heat: branch.heat, author: branch.author }
      }
      
      branch.children.forEach(child => analyze(child, depth + 1))
    }
    
    analyze(branches)
    
    return {
      totalPosts,
      uniqueAuthors: uniqueAuthors.size,
      maxDepth,
      hottestBranch: hottestBranch.heat > 0 ? hottestBranch : null
    }
  }, [branches])
  
  return (
    <div className="thread-branch-diagram-compact" ref={containerRef}>
      <div className="diagram-header-compact">
        <div className="header-title">
          <GitBranch size={12} />
          <span>Thread Map</span>
        </div>
        <div className="diagram-stats-compact">
          <span title="Total posts">
            <MessageCircle size={10} />
            {threadStats.totalPosts}
          </span>
          <span title="Unique participants">
            <Users size={10} />
            {threadStats.uniqueAuthors}
          </span>
          {threadStats.maxDepth > 2 && (
            <span title="Max depth">
              ↳{threadStats.maxDepth}
            </span>
          )}
        </div>
      </div>
      
      <div className="diagram-scroll-container-compact">
        <svg 
          ref={svgRef}
          width={svgDimensions.width} 
          height={svgDimensions.height}
        >
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {renderTree(layoutTree)}
          </motion.g>
        </svg>
      </div>
      
      {hoveredBranch && (() => {
        const branch = findBranchById(branches, hoveredBranch)
        if (!branch) return null
        
        return (
          <div className="branch-tooltip-compact">
            <div className="tooltip-author">{branch.author}</div>
            <div className="tooltip-text">{branch.text.slice(0, 80)}...</div>
            <div className="tooltip-stats">
              <span>{branch.replyCount} total replies</span>
              <span>{branch.participantCount} participants</span>
              <span>{new Date(branch.latestActivity).toLocaleTimeString()}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

const findBranchById = (branch: ThreadBranch, id: string): ThreadBranch | null => {
  if (branch.id === id) return branch
  for (const child of branch.children) {
    const found = findBranchById(child, id)
    if (found) return found
  }
  return null
}