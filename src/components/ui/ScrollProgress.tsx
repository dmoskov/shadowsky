import React, { useState, useEffect } from 'react'
import { motion, useScroll } from 'framer-motion'

export const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (value) => {
      setProgress(value)
    })
    return unsubscribe
  }, [scrollYProgress])

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-0.5 bg-blue-500 origin-left z-50"
      style={{ scaleX: progress }}
      initial={{ scaleX: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
    />
  )
}