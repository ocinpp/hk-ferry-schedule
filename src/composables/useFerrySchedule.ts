import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import Papa from 'papaparse'
import { format, addDays, parse, isAfter } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { FerryScheduleEntry, NextFerry, NextArrival } from '../types/ferry'

axiosRetry(axios, { retries: 3 });

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong'

// Helper function to get current Hong Kong time
const getHongKongTime = (): Date => {
  return toZonedTime(new Date(), HONG_KONG_TIMEZONE)
}

export function useFerrySchedule() {
  const scheduleData = ref<FerryScheduleEntry[]>([])
  const publicHolidays = ref<string[]>([])
  const nextFerries = ref<NextFerry[]>([])
  const nextArrivals = ref<NextArrival[]>([])
  const currentTime = ref(getHongKongTime())
  const loading = ref(true)
  const error = ref('')
  const isVisible = ref(true)

  const remarksMap = new Map();
  remarksMap.set("1", "Ordinary ferry service and freight service is allowed");
  remarksMap.set("2", "Ordinary ferry service and freight service is allowed and via Peng Chau for alighting passengers only");
  remarksMap.set("3", "Saturdays only and freight service is allowed (except public holidays)");

  let timeInterval: NodeJS.Timeout

  const fetchScheduleData = async () => {
    try {
      const response = await axios.get('/api/ferry-schedule')
      const parsed = Papa.parse(response.data, {
        header: true,
        skipEmptyLines: true
      })

      // Log the raw data to see the actual structure
      console.log('Raw CSV data:', parsed.data.slice(0, 5))
      console.log('First raw entry:', parsed.data[0])
      console.log('CSV headers:', parsed.meta.fields)

      scheduleData.value = parsed.data.map((row: any) => {
        // Map to actual CSV structure: Direction, Service Date, Service Hour, Remark
        const direction = row['Direction']
        const dayType = row['Service Date'] // This contains the day type info
        const departureTime = row['Service Hour'] // This contains the time
        const arrivalTime = row['Service Hour'] // For now, we'll calculate arrival time
        const remarks = remarksMap.get(row['Remark']) || ""

        return {
          direction,
          day_type: dayType,
          departure_time: departureTime,
          arrival_time: arrivalTime, // We'll need to calculate this based on journey time
          remarks: remarks
        }
      }).filter(entry => entry.departure_time && entry.direction && entry.day_type)

      console.log('Processed schedule data:', scheduleData.value.slice(0, 10))
      console.log('Sample entry structure:', scheduleData.value[0])

    } catch (err) {
      console.error('Error fetching schedule:', err)
      error.value = 'Failed to load ferry schedule'
    }
  }

  const fetchPublicHolidays = async () => {
    try {
      const response = await axios.get('/api/holidays')
      const holidays = response.data.vcalendar?.[0]?.vevent || []

      // console.log('Raw holiday data:', holidays.slice(0, 3)) // Debug log

      publicHolidays.value = holidays.map((holiday: any) => {
        // The API returns dtstart as an array where first element is the date string
        let dateStr = ''

        if (Array.isArray(holiday.dtstart)) {
          dateStr = holiday.dtstart[0]
        } else if (holiday.dtstart?.date) {
          dateStr = holiday.dtstart.date
        } else if (holiday.dtstart?.['date-time']) {
          dateStr = holiday.dtstart['date-time']
        }

        if (dateStr && typeof dateStr === 'string') {
          // Parse the date string (format: YYYYMMDD) using Hong Kong timezone
          const cleanDateStr = dateStr.substring(0, 8)
          if (cleanDateStr.match(/^\d{8}$/)) {
            // Parse in Hong Kong timezone to ensure consistency
            const parsedDate = parse(cleanDateStr, 'yyyyMMdd', getHongKongTime())
            return format(parsedDate, 'yyyy-MM-dd')
          }
        }
        return ''
      }).filter(Boolean)

      // console.log('Processed holidays:', publicHolidays.value.slice(0, 5)) // Debug log
      console.log(`✅ Loaded ${publicHolidays.value.length} Hong Kong public holidays`)

    } catch (err) {
      console.error('Error fetching holidays:', err)
      // Don't set error.value here as it might interfere with other functionality
      // Just log the error and continue without holiday data
      console.warn('Continuing without public holiday data')
    }
  }

  const fetchETAData = async () => {
    try {
      const [mwceResponse, cemwResponse] = await Promise.all([
        axios.get('/api/eta/mwce'),
        axios.get('/api/eta/cemw')
      ])

      const arrivals: NextArrival[] = []
      const now = currentTime.value

      // Helper function to parse ETA time and calculate time until arrival
      const parseETATime = (etaTimeStr: string): { etaTime: Date, isToday: boolean } | null => {
        if (!etaTimeStr || !etaTimeStr.match(/^\d{2}:\d{2}$/)) return null

        const [hours, minutes] = etaTimeStr.split(':').map(Number)
        // Use Hong Kong time for today and tomorrow
        const today = getHongKongTime()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Create potential ETA times for today and tomorrow in Hong Kong timezone
        const etaToday = new Date(today)
        etaToday.setHours(hours, minutes, 0, 0)

        const etaTomorrow = new Date(tomorrow)
        etaTomorrow.setHours(hours, minutes, 0, 0)

        // If ETA today is in the future, use it
        if (isAfter(etaToday, now)) {
          return { etaTime: etaToday, isToday: true }
        }

        // If ETA today has passed but the hour difference is more than 12,
        // assume it's for tomorrow
        const currentHour = now.getHours()
        if (Math.abs(currentHour - hours) > 12) {
          return { etaTime: etaTomorrow, isToday: false }
        }

        // If the ETA time is earlier than current time and within 12 hours,
        // it's likely in the past, so ignore it
        return null
      }

      // Process Mui Wo to Central ETA - loop through all data entries
      if (mwceResponse.data?.data && Array.isArray(mwceResponse.data.data)) {
        for (const ferry of mwceResponse.data.data) {
          if (ferry.eta) {
            const eta = parseETATime(ferry.eta)
            if (eta?.etaTime) {
              const timeUntil = Math.ceil((eta.etaTime.getTime() - now.getTime()) / (1000 * 60))
              if (timeUntil > 0) {
                const direction = 'Mui Wo to Central'
                arrivals.push({
                  direction,
                  from: direction?.split(' to ')[0] || "",
                  to: direction?.split(' to ')[1] || "",
                  arrivalTime: format(eta.etaTime, 'HH:mm'),
                  timeUntil: timeUntil > 60 ? `${Math.floor(timeUntil / 60)}h ${timeUntil % 60}m` : `${timeUntil}m`,
                  isToday: eta.isToday
                })
              }
            }
          }
        }
      }

      // Process Central to Mui Wo ETA - loop through all data entries
      if (cemwResponse.data?.data && Array.isArray(cemwResponse.data.data)) {
        for (const ferry of cemwResponse.data.data) {
          if (ferry.eta) {
            const eta = parseETATime(ferry.eta)
            if (eta?.etaTime) {
              const timeUntil = Math.ceil((eta.etaTime.getTime() - now.getTime()) / (1000 * 60))
              if (timeUntil > 0) {
                const direction = 'Central to Mui Wo'
                arrivals.push({
                  direction,
                  from: direction?.split(' to ')[0] || "",
                  to: direction?.split(' to ')[1] || "",
                  arrivalTime: format(eta.etaTime, 'HH:mm'),
                  timeUntil: timeUntil > 60 ? `${Math.floor(timeUntil / 60)}h ${timeUntil % 60}m` : `${timeUntil}m`,
                  isToday: eta.isToday
                })
              }
            }
          }
        }
      }

      // Sort arrivals by arrival time (earliest first)
      arrivals.sort((a, b) => {
        const timeA = parse(a.arrivalTime, 'HH:mm', new Date())
        const timeB = parse(b.arrivalTime, 'HH:mm', new Date())
        return timeA.getTime() - timeB.getTime()
      })

      nextArrivals.value = arrivals
    } catch (err) {
      console.error('Error fetching ETA data:', err)
      // Continue without ETA data
    }
  }

  const isPublicHoliday = (date: Date): boolean => {
    // Ensure we're checking the date in Hong Kong timezone
    const hkDate = toZonedTime(date, HONG_KONG_TIMEZONE)
    const dateStr = format(hkDate, 'yyyy-MM-dd')
    const isHoliday = publicHolidays.value.includes(dateStr)

    // Debug logging (only for holidays)
    if (isHoliday) {
      console.log(`🎉 Public holiday detected: ${dateStr}`)
    }

    return isHoliday
  }

  const getDayType = (date: Date): string => {
    // Ensure we're working with Hong Kong timezone
    const hkDate = toZonedTime(date, HONG_KONG_TIMEZONE)
    const dayOfWeek = hkDate.getDay()
    const isHoliday = isPublicHoliday(hkDate)

    let dayType = ''
    if (isHoliday || dayOfWeek === 0) {
      dayType = 'Sundays and public holidays' // Sunday or Public Holiday
    } else if (dayOfWeek === 6) {
      dayType = 'Saturdays except public holidays' // Saturday
    } else {
      dayType = 'Mondays to Fridays except public holidays' // Monday to Friday
    }

    return dayType
  }

  const parseTime = (timeStr: string, date: Date): Date => {
    if (!timeStr) return new Date()

    const cleanTimeStr = timeStr.trim()
    const [time, period] = cleanTimeStr.split(' ')
    let [hours, minutes] = time.split(':').map(Number)

    if (period === 'p.m.' && hours !== 12) hours += 12
    if (period === 'a.m.' && hours === 12) hours = 0

    const result = new Date(date)
    result.setHours(hours, minutes, 0, 0)
    return result
  }

  const findNextFerries = () => {
    const now = currentTime.value
    const today = getHongKongTime()
    const tomorrow = addDays(today, 1)

    const todayType = getDayType(today)
    const tomorrowType = getDayType(tomorrow)

    console.log('Current time:', format(now, 'yyyy-MM-dd HH:mm'))
    console.log('Today type:', todayType)
    console.log('Tomorrow type:', tomorrowType)
    console.log('Total schedule entries:', scheduleData.value.length)

    // Get unique directions from the data
    const uniqueDirections = [...new Set(scheduleData.value.map(entry => entry.direction))]
    console.log('Available directions:', uniqueDirections)

    // Map directions more flexibly
    const directions = [
      {
        name: 'Central to Mui Wo',
        filters: ['Central to Mui Wo', 'Central-Mui Wo', 'Central → Mui Wo', 'Central->Mui Wo']
      },
      {
        name: 'Mui Wo to Central',
        filters: ['Mui Wo to Central', 'Mui Wo-Central', 'Mui Wo → Central', 'Mui Wo->Central']
      }
    ]

    const results: NextFerry[] = []

    directions.forEach(({ name: direction, filters }) => {
      let nextFerry: NextFerry | null = null

      // Check today's schedule first
      const todayEntries = scheduleData.value.filter(entry =>
        filters.some(filter => entry.direction && entry.direction.includes(filter)) &&
        entry.day_type === todayType
      )

      console.log(`${direction} - Today entries (${todayType}):`, todayEntries.length)

      for (const entry of todayEntries) {
        const departureTime = parseTime(entry.departure_time, today)
        const arrivalTime = parseTime(entry.arrival_time, today)

        console.log(`Checking ${direction}: ${entry.departure_time} -> ${format(departureTime, 'HH:mm')} vs now ${format(now, 'HH:mm')}`)

        if (isAfter(departureTime, now)) {
          const timeUntil = Math.ceil((departureTime.getTime() - now.getTime()) / (1000 * 60))
          nextFerry = {
            direction,
            from: direction?.split(' to ')[0] || "",
            to: direction?.split(' to ')[1] || "",
            departureTime: format(departureTime, 'HH:mm'),
            arrivalTime: format(arrivalTime, 'HH:mm'),
            timeUntil: timeUntil > 60 ? `${Math.floor(timeUntil / 60)}h ${timeUntil % 60}m` : `${timeUntil}m`,
            isToday: true,
            remarks: entry.remarks
          }
          break
        }
      }

      // If no ferry found today, check tomorrow
      if (!nextFerry) {
        const tomorrowEntries = scheduleData.value.filter(entry =>
          filters.some(filter => entry.direction && entry.direction.includes(filter)) &&
          entry.day_type === tomorrowType
        )

        console.log(`${direction} - Tomorrow entries (${tomorrowType}):`, tomorrowEntries.length)

        if (tomorrowEntries.length > 0) {
          const firstEntry = tomorrowEntries[0]
          const departureTime = parseTime(firstEntry.departure_time, tomorrow)
          const arrivalTime = parseTime(firstEntry.arrival_time, tomorrow)

          const timeUntil = Math.ceil((departureTime.getTime() - now.getTime()) / (1000 * 60))
          nextFerry = {
            direction,
            from: direction?.split(' to ')[0] || "",
            to: direction?.split(' to ')[1] || "",
            departureTime: format(departureTime, 'HH:mm'),
            arrivalTime: format(arrivalTime, 'HH:mm'),
            timeUntil: timeUntil > 60 ? `${Math.floor(timeUntil / 60)}h ${timeUntil % 60}m` : `${timeUntil}m`,
            isToday: false,
            remarks: firstEntry.remarks
          }
        }
      }

      if (nextFerry) {
        results.push(nextFerry)
      }
    })

    console.log('Final results:', results)
    nextFerries.value = results
  }

  const updateTime = () => {
    currentTime.value = getHongKongTime()
    // Always refresh ferry data when time updates to ensure current departures
    findNextFerries()
    fetchETAData()
  }

  // Handle visibility change to detect when tab becomes active/inactive
  const handleVisibilityChange = () => {
    isVisible.value = !document.hidden

    if (isVisible.value) {
      // Tab became visible - immediately update data
      console.log('Tab became visible - refreshing data')
      updateTime()

      // Reset interval to ensure proper timing
      if (timeInterval) {
        clearInterval(timeInterval)
      }

      // Recalculate sync with minute boundary using Hong Kong time
      const now = getHongKongTime()
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

      // Schedule the next update (every 30 seconds)
      setTimeout(() => {
        updateTime()
        timeInterval = setInterval(updateTime, 30000)
      }, msUntilNextMinute)
    }
  }

  // Use requestAnimationFrame for more reliable timing
  const scheduleNextUpdate = () => {
    const now = getHongKongTime()
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

    const timeoutId = setTimeout(() => {
      if (isVisible.value) {
        updateTime()
      }

      // Schedule the next update (every 30 seconds)
      timeInterval = setInterval(() => {
        if (isVisible.value) {
          updateTime()
        }
      }, 30000)
    }, msUntilNextMinute)

    return timeoutId
  }

  const initialize = async () => {
    loading.value = true
    await Promise.all([fetchScheduleData(), fetchPublicHolidays(), fetchETAData()])
    findNextFerries()
    loading.value = false
  }

  onMounted(() => {
    initialize()

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Schedule the first update
    scheduleNextUpdate()
  })

  onUnmounted(() => {
    if (timeInterval) {
      clearInterval(timeInterval)
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  // Utility function for testing holiday functionality
  const testHolidayForDate = (dateString: string) => {
    const testDate = new Date(dateString)
    const hkDate = toZonedTime(testDate, HONG_KONG_TIMEZONE)
    const isHoliday = isPublicHoliday(hkDate)
    const dayType = getDayType(hkDate)

    console.log(`=== Holiday Test for ${dateString} ===`)
    console.log(`Hong Kong date: ${format(hkDate, 'yyyy-MM-dd')}`)
    console.log(`Is public holiday: ${isHoliday}`)
    console.log(`Day type: ${dayType}`)
    console.log(`Available holidays: ${publicHolidays.value.length}`)
    console.log(`First few holidays: ${publicHolidays.value.slice(0, 5).join(', ')}`)
    console.log('=====================================')

    return { isHoliday, dayType, hkDate: format(hkDate, 'yyyy-MM-dd') }
  }

  return {
    scheduleData,
    nextFerries,
    nextArrivals,
    currentTime,
    loading,
    error,
    getDayType,
    isPublicHoliday,
    testHolidayForDate,
    publicHolidays: publicHolidays.value
  }
}