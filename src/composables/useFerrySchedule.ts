import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import Papa from 'papaparse'
import { format, addDays, parse, isAfter } from 'date-fns'
import type { FerryScheduleEntry, NextFerry, PublicHoliday } from '../types/ferry'

export function useFerrySchedule() {
  const scheduleData = ref<FerryScheduleEntry[]>([])
  const publicHolidays = ref<string[]>([])
  const nextFerries = ref<NextFerry[]>([])
  const currentTime = ref(new Date())
  const loading = ref(true)
  const error = ref('')

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

      publicHolidays.value = holidays.map((holiday: PublicHoliday) => {
        const dateStr = holiday.dtstart?.date || holiday.dtstart?.['date-time']
        if (dateStr) {
          return format(parse(dateStr.substring(0, 8), 'yyyyMMdd', new Date()), 'yyyy-MM-dd')
        }
        return ''
      }).filter(Boolean)

    } catch (err) {
      console.error('Error fetching holidays:', err)
      // Continue without holiday data
    }
  }

  const isPublicHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return publicHolidays.value.includes(dateStr)
  }

  const getDayType = (date: Date): string => {
    const dayOfWeek = date.getDay()
    const isHoliday = isPublicHoliday(date)

    if (isHoliday || dayOfWeek === 0) return 'Sundays and public holidays' // Sunday or Public Holiday
    if (dayOfWeek === 6) return 'Saturdays except public holidays' // Saturday
    return 'Mondays to Fridays except public holidays' // Monday to Friday
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
    const today = new Date(now)
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
    currentTime.value = new Date()
    // Always refresh ferry data when time updates to ensure current departures
    findNextFerries()
  }

  const initialize = async () => {
    loading.value = true
    await Promise.all([fetchScheduleData(), fetchPublicHolidays()])
    findNextFerries()
    loading.value = false
  }

  onMounted(() => {
    initialize()

    // Calculate milliseconds until next minute boundary
    const now = new Date()
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

    // Set initial timeout to sync with minute boundary
    setTimeout(() => {
      updateTime() // Update immediately when we hit the minute boundary
      // Then set regular interval for every minute
      timeInterval = setInterval(updateTime, 60000)
    }, msUntilNextMinute)
  })

  onUnmounted(() => {
    if (timeInterval) {
      clearInterval(timeInterval)
    }
  })

  return {
    scheduleData,
    nextFerries,
    currentTime,
    loading,
    error,
    getDayType,
    isPublicHoliday
  }
}