<template>
  <span :class="badgeClass">
    <span>{{ label }}</span>
    <span v-if="lastChecked">· {{ relativeDate }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: 'unverified' | 'auto_processed' | 'verified',
  lastChecked?: string
}>();

const label = computed(() => {
  switch (props.status) {
    case 'unverified': return 'Ungeprüft';
    case 'auto_processed': return 'Automatisch';
    case 'verified': return 'Verifiziert';
    default: return props.status;
  }
});

const badgeClass = computed(() => {
  return [
    'inline-flex items-center px-2 py-1 rounded text-xs font-semibold',
    props.status === 'verified' ? 'bg-green-100 text-green-800' :
    props.status === 'auto_processed' ? 'bg-yellow-100 text-yellow-800' :
    'bg-gray-100 text-gray-800'
  ];
});

const relativeDate = computed(() => {
  if (!props.lastChecked) return '';
  const date = new Date(props.lastChecked);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `${Math.floor(diff/60)} min`;
  if (diff < 86400) return `${Math.floor(diff/3600)} h`;
  return date.toLocaleDateString();
});
</script>
