<script setup lang="ts">
import { ref } from 'vue';

const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
const { data, pending, error } = await useAsyncData('benefits', () =>
  $fetch(`${apiBase}/api/benefits`)
);

// Map status to UI style
function statusColor(status: string) {
  switch (status) {
    case 'ok':
      return 'success';
    case 'not_found':
      return 'error';
    case 'error':
      return 'warning';
    default:
      return 'neutral';
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-semibold">Benefits</h1>

    <div v-if="pending" class="loading loading-spinner loading-md text-primary">Loading…</div>
    <div v-else-if="error" class="alert alert-error text-sm">Failed to load.</div>

    <div v-else class="grid gap-4">
      <div
        v-for="(item, i) in data"
        :key="i"
        class="card bg-base-100 shadow-md border border-base-300 hover:shadow-xl hover:bg-base-200 transition duration-200 ease-in-out cursor-pointer"
        :class="{ 'opacity-60': item.status !== 'ok' }"
        :to="`/benefits/${i}`"
        @click="$router.push(`/benefits/${i}`)"
      >
        <div class="card-body p-4">
          <div class="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 class="card-title text-lg">
                {{ item.title || item.h1 || item.url }}
              </h2>
              <p class="text-sm opacity-70">
                {{ item.source }} • {{ item.topic }}
              </p>
            </div>
            <UBadge :color="statusColor(item.status)" size="sm">
              {{ item.status }}
            </UBadge>
          </div>

          <p v-if="item.meta_description" class="text-sm mb-1">{{ item.meta_description }}</p>
          <p v-if="item.excerpt" class="text-sm">{{ item.excerpt }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
