<template>
  <div class="card bg-base-100 shadow-xl mb-4 focus-within:ring-2 focus-within:ring-primary transition">
    <div class="card-body p-4 flex flex-col gap-2">
      <div class="mb-2">
        <span class="badge badge-info px-2 py-1 text-xs font-semibold">{{ readableType(type) }}</span>
        <StatusBadge :status="status" :last-checked="lastChecked" />
      </div>
      <div class="card-title text-lg font-bold">
        {{ titleDe || titleEn || titleSimpleDe || id }}
      </div>
      <div class="text-base text-base-content/80 mb-2">{{ summaryDe || summaryEn || summarySimpleDe }}</div>
      <div v-if="domain" class="text-xs text-gray-400 flex items-center gap-1 mb-2">
        <img :src="`https://www.google.com/s2/favicons?domain=${domain}`" class="w-4 h-4">
        <span>{{ domain }}</span>
      </div>
      <NuxtLink
        :to="`/entities/${id}`"
        class="btn btn-primary btn-sm w-fit"
        :aria-label="`Details zu ${titleDe || titleEn || titleSimpleDe || id}`"
      >
        Details ansehen
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue';

defineProps<{
  id: string;
  type: string;
  url?: string;
  titleDe?: string;
  titleEn?: string;
  titleSimpleDe?: string;
  summaryDe?: string;
  summaryEn?: string;
  summarySimpleDe?: string;
  status: 'unverified' | 'auto_processed' | 'verified';
  lastChecked?: string;
  topics?: string[];
  domain?: string;
}>();

function readableType(type: string) {
  // Map technical types to user-friendly labels
  switch (type) {
    case 'benefit': return 'Finanzielle Unterstützung';
    case 'service': return 'Service';
    case 'tool': return 'Tool';
    case 'form': return 'Formular';
    case 'glossary': return 'Glossar';
    case 'legal_aid': return 'Rechtsberatung';
    case 'association': return 'Verein';
    case 'organization': return 'Organisation';
    default: return type;
  }
}
</script>
