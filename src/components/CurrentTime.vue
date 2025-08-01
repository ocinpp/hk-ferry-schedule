<script setup lang="ts">
import { computed } from "vue";
import { format } from "date-fns";

const props = defineProps<{
  currentTime: Date;
  dayType: string;
  isHoliday: boolean;
}>();

const formattedDate = computed(() =>
  format(props.currentTime, "EEEE, MMMM do, yyyy")
);

const formattedTimeNoSeconds = computed(() =>
  format(props.currentTime, "HH:mm")
);
</script>

<template>
  <div
    class="bg-gradient-to-r from-ocean-600 to-ocean-800 text-gray rounded-lg p-2 shadow-lg"
  >
    <div class="text-center">
      <h2 class="text-sm font-medium opacity-90 mb-2">Hong Kong Time</h2>
      <div class="text-3xl font-bold mb-2 font-mono">
        {{ formattedTimeNoSeconds }}
      </div>
      <div class="text-sm opacity-90">{{ formattedDate }}</div>

      <div class="mt-1 flex justify-center items-center space-x-4">
        <div class="bg-white/20 rounded-full px-3 py-1">
          <span class="text-sm font-medium">{{ dayType }}</span>
        </div>
        <div v-if="isHoliday" class="bg-red-500/80 rounded-full px-3 py-1">
          <span class="text-sm font-medium">Public Holiday</span>
        </div>
      </div>
    </div>
  </div>
</template>
