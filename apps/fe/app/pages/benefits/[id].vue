<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

// Fetch all benefits and select by index
const { data, pending, error } = await useAsyncData('benefitDetail', async () => {
  const all = await $fetch(`${apiBase}/api/benefits`);
  return all[Number(route.params.id)];
});

function statusColor(status: string) {
  switch (status) {
    case 'ok':
      return 'success';
    case 'not_found':
      return 'error';
    case 'error':
      return 'warning';
    default:
      return 'gray';
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <UButton to="/benefits" variant="ghost">← Back to list</UButton>

    <div v-if="pending">Loading…</div>
    <div v-else-if="error || !data">Not found.</div>

    <div v-else>
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-semibold">{{ data.title || data.h1 || data.url }}</h1>
        <UBadge :color="statusColor(data.status)" size="md">{{ data.status }}</UBadge>
      </div>

      <UCard>
        <template #header>
          <p class="text-sm opacity-70">{{ data.source }} • {{ data.topic }}</p>
        </template>

        <div class="space-y-3">
          <p><strong>URL:</strong> <a :href="data.url" target="_blank" class="text-primary underline">{{ data.url }}</a></p>
          <p v-if="data.meta_description"><strong>Meta description:</strong> {{ data.meta_description }}</p>
          <p v-if="data.excerpt"><strong>Excerpt:</strong> {{ data.excerpt }}</p>
          <p v-if="data.content"><strong>Content:</strong> {{ data.content }}</p>
        </div>
      </UCard>
    </div>
  </div>
</template>
