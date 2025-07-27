<script setup lang="ts">
import type { NextFerry } from "../types/ferry";

defineProps<{
  ferry: NextFerry;
}>();
</script>

<template>
  <div
    class="bg-white rounded-lg shadow-lg p-6 border-l-4 hover:shadow-xl transition-shadow duration-300"
    :class="
      ferry.direction.startsWith('Mui') ? 'border-green-700' : 'border-red-500'
    "
  >
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">{{ ferry.direction }}</h3>
      <div class="flex items-center space-x-2">
        <svg
          class="w-6 h-6 text-ocean-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
          />
        </svg>
        <span class="text-sm text-gray-700">
          {{ ferry.isToday ? "Today" : "Tomorrow" }}
        </span>
      </div>
    </div>

    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-700">Departure:</span>
        <span class="text-xl font-bold text-ocean-700">{{
          ferry.departureTime
        }}</span>
      </div>

      <!-- <div class="flex justify-between items-center">
        <span class="text-sm text-gray-700">Arrival:</span>
        <span class="text-lg font-medium text-gray-800">{{
          ferry.arrivalTime
        }}</span>
      </div> -->

      <div class="flex justify-between items-center">
        <span class="text-sm text-ocean-700">Time until departure:</span>
        <span class="text-lg font-medium text-ocean-800">{{
          ferry.timeUntil
        }}</span>
      </div>

      {{ ferry.remarks }}
    </div>
  </div>
</template>
