// Simple test to verify Hong Kong timezone functionality
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong'

// Helper function to get current Hong Kong time
const getHongKongTime = () => {
  return toZonedTime(new Date(), HONG_KONG_TIMEZONE)
}

// Test that Hong Kong time is different from UTC
const testHongKongTime = () => {
  const utcTime = new Date()
  const hkTime = getHongKongTime()
  
  console.log('UTC Time:', format(utcTime, 'yyyy-MM-dd HH:mm:ss'))
  console.log('Hong Kong Time:', format(hkTime, 'yyyy-MM-dd HH:mm:ss'))
  
  // Hong Kong is UTC+8, so there should be an 8-hour difference (or 7 during DST)
  const timeDiffHours = (hkTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60)
  console.log('Time difference (hours):', timeDiffHours)
  
  // The difference should be around 8 hours (Hong Kong doesn't observe DST)
  const expectedDiff = 8
  const tolerance = 1 // Allow 1 hour tolerance for edge cases
  
  if (Math.abs(timeDiffHours - expectedDiff) <= tolerance) {
    console.log('✅ Hong Kong timezone test PASSED')
    return true
  } else {
    console.log('❌ Hong Kong timezone test FAILED')
    return false
  }
}

// Run the test
if (typeof window === 'undefined') {
  // Node.js environment
  testHongKongTime()
} else {
  // Browser environment - expose to global scope for manual testing
  window.testHongKongTime = testHongKongTime
  console.log('Hong Kong timezone test available as window.testHongKongTime()')
}
