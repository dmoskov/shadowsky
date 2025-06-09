import React, { useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import type { ThreadViewPost } from '../../services/atproto/thread'

interface ThreadOverviewMapProps {
  thread: ThreadViewPost
  currentPostUri?: string
  onNavigate: (uri: string) => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  onClose?: () => void
}

// Feature flag - easy to disable
export const THREAD_MAP_ENABLED = true

export const ThreadOverviewMap: React.FC<ThreadOverviewMapProps> = ({
  thread,
  currentPostUri,
  onNavigate,
  isExpanded = false,
  onToggleExpand,
  onClose
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  
  // Build thread structure for visualization
  const threadStructure = useMemo(() => {
    const nodes: Array<{
      uri: string
      author: string
      depth: number
      x: number
      y: number
      hasReplies: boolean
      replyCount: number
    }> = []
    
    let yOffset = 0
    const nodeSpacing = isExpanded ? 40 : 25
    const depthSpacing = isExpanded ? 60 : 30
    
    function processNode(node: ThreadViewPost, depth: number, parentX: number = 0) {
      const x = parentX + (depth > 0 ? depthSpacing : 0)
      const y = yOffset
      yOffset += nodeSpacing
      
      nodes.push({
        uri: node.post.uri,
        author: node.post.author.handle,
        depth,
        x,
        y,
        hasReplies: !!(node.replies && node.replies.length > 0),
        replyCount: node.replies?.length || 0
      })
      
      if (node.replies) {
        node.replies.forEach((reply) => {
          if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
            processNode(reply as ThreadViewPost, depth + 1, x)
          }
        })
      }
    }
    
    processNode(thread, 0)
    return nodes
  }, [thread, isExpanded])
  
  // Scroll to current post
  useEffect(() => {
    if (currentPostUri && mapRef.current) {
      const currentNode = mapRef.current.querySelector(`[data-uri="${currentPostUri}"]`)
      if (currentNode) {
        currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentPostUri])
  
  if (!THREAD_MAP_ENABLED) return null
  
  const maxDepth = Math.max(...threadStructure.map(n => n.depth))
  const mapWidth = (maxDepth + 1) * (isExpanded ? 60 : 30) + 100
  const mapHeight = threadStructure.length * (isExpanded ? 40 : 25) + 40
  
  return (
    <AnimatePresence>
      <motion.div
        className={`bg-gray-800 border border-gray-700 rounded-lg ${isExpanded ? 'w-full max-w-4xl' : 'w-80'} max-h-96 flex flex-col`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="font-semibold">Thread Map</h3>
          <div className="flex items-center gap-1">
            {onToggleExpand && (
              <button
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                onClick={onToggleExpand}
                aria-label={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            {onClose && (
              <button
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                onClick={onClose}
                aria-label="Close map"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-2" ref={mapRef}>
          <svg
            width={mapWidth}
            height={mapHeight}
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="w-full h-full"
          >
            {/* Draw connection lines */}
            {threadStructure.map((node, index) => {
              if (node.depth === 0) return null
              
              // Find parent node
              let parentIndex = index - 1
              while (parentIndex >= 0 && threadStructure[parentIndex].depth >= node.depth) {
                parentIndex--
              }
              
              if (parentIndex >= 0) {
                const parent = threadStructure[parentIndex]
                return (
                  <line
                    key={`line-${node.uri}`}
                    x1={parent.x + 20}
                    y1={parent.y + 10}
                    x2={node.x + 20}
                    y2={node.y + 10}
                    stroke="#374151"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                )
              }
              return null
            })}
            
            {/* Draw nodes */}
            {threadStructure.map((node) => (
              <g
                key={node.uri}
                data-uri={node.uri}
                className="map-node-group"
                onClick={() => onNavigate(node.uri)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={node.x + 20}
                  cy={node.y + 10}
                  r={isExpanded ? 12 : 8}
                  className={`transition-colors ${currentPostUri === node.uri ? 'current' : ''}`}
                  fill={currentPostUri === node.uri ? '#3b82f6' : '#1f2937'}
                  stroke={node.hasReplies ? '#374151' : 'transparent'}
                  strokeWidth="2"
                />
                {isExpanded && (
                  <text
                    x={node.x + 35}
                    y={node.y + 14}
                    className="text-xs"
                    fontSize="10"
                    fill="#9ca3af"
                  >
                    @{node.author.split('.')[0]}
                    {node.replyCount > 0 && ` (${node.replyCount})`}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
        
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-700 border border-gray-600" />
              <span>Has replies</span>
            </div>
          </div>
          <span>{threadStructure.length} posts</span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}