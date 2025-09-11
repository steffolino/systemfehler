<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

const id = computed(() => String(route.params.id))

const { data, pending, error } = await useAsyncData(
  'benefitDetail',
  async () => {
    try {
      return await $fetch(`${apiBase}/api/benefits/${id.value}`)
    } catch (e) {
      return null
    }
  },
  { watch: [id] }
)

function statusBadgeClass(status: string) {
  switch (status) {
    case 'ok': return 'badge badge-success'
    case 'not_found': return 'badge badge-error'
    case 'error': return 'badge badge-warning'
    default: return 'badge badge-neutral'
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Back to list -->
    <NuxtLink to="/benefits" class="btn btn-ghost gap-2">
      <Icon name="heroicons:arrow-left-20-solid" />
      {{ $t('backToList') }}
    </NuxtLink>

    <!-- Loading / error states -->
    <div v-if="pending" class="flex items-center gap-2 text-base-content/70">
      <span class="loading loading-spinner"/> {{ $t('loading') }}
    </div>
    <div v-else-if="error || !data" class="alert alert-error">
      {{ $t('notFound') }}
    </div>

    <!-- Detail content -->
    <div v-else class="space-y-4">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-semibold">
          {{ data.title || data.h1 || data.url }}
        </h1>
        <span :class="statusBadgeClass(data.status)">
          {{ $t(`status_${data.status || 'unknown'}`) }}
        </span>
      </div>

      <div class="card border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body space-y-3">
          <p class="text-sm opacity-70">
            {{ data.source }} • {{ data.topic }}
          </p>

          <p>
            <strong>{{ $t('url') }}:</strong>
            <a :href="data.url" target="_blank" rel="noopener" class="link link-primary">
              {{ data.url }}
            </a>
          </p>

          <p v-if="data.meta_description">
            <strong>{{ $t('metaDescription') }}:</strong> {{ data.meta_description }}
          </p>

          <p v-if="data.excerpt">
            <strong>{{ $t('excerpt') }}:</strong> {{ data.excerpt }}
          </p>

          <p v-if="data.content">
            <strong>{{ $t('content') }}:</strong> {{ data.content }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>