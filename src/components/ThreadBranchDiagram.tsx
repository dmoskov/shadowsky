import React, { useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, GitBranch, Users, Clock } from 'lucide-react'
import type { ThreadViewPost } from '../services/atproto/thread'

interface ThreadBranch {
  id: string
  uri: string
  author: string
  authorHandle: string
  authorAvatar?: string
  text: string
  depth: number
  replyCount: number
  participantCount: number
  latestActivity: Date
  heat: number
  children: ThreadBranch[]
  parent?: ThreadBranch
  x?: number
  y?: number
  color?: string
  isMainLine?: boolean
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

// Color palette for branches
const BRANCH_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]

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
        authorAvatar: node.post.author.avatar,
        text: (node.post.record as any)?.text || '',
        depth,
        replyCount: totalReplies,
        participantCount: participants.size,
        latestActivity: latestTime,
        heat,
        children,
        parent,
        color: BRANCH_COLORS[colorIndex],
        isMainLine: depth === 0 || (parent && parent.children.indexOf(branch) === 0)
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
      authorAvatar: thread.post.author.avatar,
      text: (thread.post.record as any)?.text || '',
      depth: 0,
      replyCount: 0,
      participantCount: 1,
      latestActivity: new Date(thread.post.indexedAt),
      heat: 0,
      children: [],
      color: BRANCH_COLORS[0]
    }
  }, [thread])
  
  // Calculate git-style layout
  const layoutTree = useMemo(() => {
    const NODE_HEIGHT = 80
    const COLUMN_WIDTH = 40
    const START_Y = 40
    
    let nextY = START_Y
    let maxColumn = 0
    const occupiedColumns = new Map<number, number>() // column -> lastY
    
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
        nextY += NODE_HEIGHT
      }
      
      occupiedColumns.set(column, y)
      maxColumn = Math.max(maxColumn, column)
      
      const node: LayoutNode = {
        branch,
        x: column * COLUMN_WIDTH + 40,
        y,
        children: [],
        column
      }
      
      // Layout children
      branch.children.forEach((child, index) => {
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
      maxX = Math.max(maxX, node.x + 200) // account for node width
      maxY = Math.max(maxY, node.y + 80)
      node.children.forEach(traverse)
    }
    
    traverse(layoutTree)
    return { width: maxX + 40, height: maxY + 40 }
  }, [layoutTree])
  
  // Render git-style connection
  const renderConnection = (parent: LayoutNode, child: LayoutNode) => {
    const parentX = parent.x
    const parentY = parent.y + 40 // center of node
    const childX = child.x
    const childY = child.y + 40
    
    let path: string
    
    if (parent.column === child.column) {
      // Straight line
      path = `M ${parentX} ${parentY} L ${parentX} ${childY}`
    } else {
      // Branch line with curve
      const midY = parentY + 20
      path = `M ${parentX} ${parentY} 
              L ${parentX} ${midY}
              Q ${parentX} ${childY} ${childX} ${childY}`
    }
    
    return (
      <motion.path
        key={`${parent.branch.id}-${child.branch.id}`}
        d={path}
        stroke={child.branch.color}
        strokeWidth="3"
        fill="none"
        opacity={0.8}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: child.branch.depth * 0.1 }}
      />
    )
  }
  
  // Render branch node (git-style commit)
  const renderNode = (node: LayoutNode) => {
    const { branch, x, y } = node
    const isActive = branch.uri === currentPostUri
    const isHovered = hoveredBranch === branch.id
    
    return (
      <motion.g
        key={branch.id}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: branch.depth * 0.05 }}
        onMouseEnter={() => setHoveredBranch(branch.id)}
        onMouseLeave={() => setHoveredBranch(null)}
        onClick={() => onNavigate(branch.uri)}
        style={{ cursor: 'pointer' }}
      >
        {/* Commit dot */}
        <circle
          cx={x}
          cy={y + 40}
          r={isActive ? 8 : 6}
          fill={branch.color}
          stroke={isActive ? '#fff' : branch.color}
          strokeWidth={isActive ? 3 : 0}
        />
        
        {/* Branch label/content */}
        <foreignObject
          x={x + 20}
          y={y}
          width={160}
          height={80}
          style={{ overflow: 'visible' }}
        >
          <div 
            className={`branch-node ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
            style={{
              background: isActive ? branch.color : (isHovered ? '#374151' : '#2d3748'),
              borderColor: branch.color,
              borderWidth: '2px',
              borderStyle: 'solid',
              borderRadius: '8px',
              padding: '8px',
              color: '#fff',
              fontSize: '12px',
              height: '64px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {branch.author.slice(0, 18)}{branch.author.length > 18 ? '…' : ''}
            </div>
            <div style={{ 
              fontSize: '11px', 
              opacity: 0.9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {branch.text.slice(0, 30)}{branch.text.length > 30 ? '…' : ''}
            </div>
            <div style={{ 
              fontSize: '10px', 
              opacity: 0.7,
              display: 'flex',
              gap: '8px',
              marginTop: '4px'
            }}>
              <span>{branch.replyCount} replies</span>
              {branch.heat > 0.5 && <span>🔥</span>}
            </div>
          </div>
        </foreignObject>
      </motion.g>
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
  
  return (
    <div className="thread-branch-diagram-v2" ref={containerRef}>
      <div className="diagram-header">
        <h4>
          <GitBranch size={16} />
          Thread Structure
        </h4>
        <div className="diagram-stats">
          <span>
            <MessageCircle size={12} />
            {branches.replyCount} replies
          </span>
          <span>
            <Users size={12} />
            {branches.participantCount} people
          </span>
        </div>
      </div>
      
      <div className="diagram-scroll-container">
        <svg 
          ref={svgRef}
          width={svgDimensions.width} 
          height={svgDimensions.height}
        >
          {renderTree(layoutTree)}
        </svg>
      </div>
      
      {hoveredBranch && (
        <div className="branch-tooltip-v2">
          {(() => {
            const branch = findBranchById(branches, hoveredBranch)
            if (!branch) return null
            return (
              <>
                <strong>{branch.author}</strong>
                <div className="tooltip-text">{branch.text.slice(0, 100)}...</div>
                <div className="tooltip-meta">
                  {new Date(branch.latestActivity).toLocaleTimeString()} • 
                  {branch.replyCount} replies • 
                  {branch.participantCount} participants
                </div>
              </>
            )
          })()}
        </div>
      )}
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