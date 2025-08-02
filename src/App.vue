<script setup lang="ts">
import { computed } from "vue";
import { useFerrySchedule } from "./composables/useFerrySchedule";
import DepartureCard from "./components/DepartureCard.vue";
import ArrivalCard from "./components/ArrivalCard.vue";
import CurrentTime from "./components/CurrentTime.vue";

const {
  nextFerries,
  nextArrivals,
  currentTime,
  loading,
  error,
  getDayType,
  isPublicHoliday,
} = useFerrySchedule();

const dayType = computed(() => getDayType(currentTime.value));
const isHoliday = computed(() => isPublicHoliday(currentTime.value));
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-ocean-50 to-blue-100">
    <div class="container mx-auto px-4 py-4 max-w-4xl">
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">
          Central ⇄ Mui Wo Ferry
        </h1>
      </div>

      <!-- Current Time Display -->
      <div class="mb-8">
        <CurrentTime
          :current-time="currentTime"
          :day-type="dayType"
          :is-holiday="isHoliday"
        />
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-ocean-500 border-t-transparent"
        ></div>
        <p class="mt-4 text-gray-800">Loading ferry schedule...</p>
      </div>

      <!-- Error State -->
      <div
        v-if="error"
        class="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
      >
        <div class="text-red-600 text-lg font-medium mb-2">
          ⚠️ Unable to Load Schedule
        </div>
        <p class="text-red-500">{{ error }}</p>
      </div>

      <!-- Next Ferries -->
      <div v-if="!loading && !error" class="space-y-6">
        <h2 class="text-2xl font-bold text-gray-900 text-center mb-6">
          Next Ferry Departures
        </h2>

        <div v-if="nextFerries.length > 0" class="grid gap-6 md:grid-cols-2">
          <DepartureCard
            v-for="ferry in nextFerries"
            :key="ferry.direction"
            :ferry="ferry"
          />
        </div>

        <div v-else class="text-center py-12">
          <div class="text-gray-800 text-lg">🚫 No upcoming ferries found</div>
          <p class="text-gray-700 mt-2">
            Please check the schedule or try again later
          </p>
        </div>

        <!-- Next Arrivals -->
        <h2 class="text-2xl font-bold text-gray-900 text-center mb-6 mt-6">
          Next Ferry Arrivals
        </h2>

        <div v-if="nextArrivals.length > 0" class="grid gap-6 md:grid-cols-2">
          <ArrivalCard
            v-for="arrival in nextArrivals"
            :key="arrival.direction"
            :arrival="arrival"
          />
        </div>

        <div v-else class="text-center py-12">
          <div class="text-gray-800 text-lg">🚫 No upcoming arrivals found</div>
          <p class="text-gray-700 mt-2">No ferries currently en route</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-12 text-center text-gray-500 text-sm">
        <p>
          Schedule data from
          <a
            href="https://www.sunferry.com.hk"
            target="_blank"
            class="text-ocean-700 hover:underline font-medium"
          >
            Sun Ferry
          </a>
        </p>
        <p class="mt-1">Updates every minute • Hong Kong Time Zone</p>
      </div>
    </div>
  </div>
</template>
