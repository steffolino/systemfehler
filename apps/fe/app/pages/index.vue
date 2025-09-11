<script setup lang="ts">
import { ref, computed } from 'vue'
import { searchEntries } from '~/composables/useSearch'
import HeroBurst from '~/components/global/HeroBurst.vue'
import { useSearchFilterStore } from '@/stores/searchFilter'

const q = ref('')
const hits = ref<any[]>([])
const loading = ref(false)
const filterStore = useSearchFilterStore()

const topic = computed(() => filterStore.topic)

async function runSearch() {
  loading.value = true
  try {
    const result = await searchEntries({ q: q.value, topic: topic.value, limit: 10 })
    hits.value = result && Array.isArray(result.results) ? result.results : []
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="container mx-auto px-4 py-4 space-y-4 text-center">
    <div class="max-w-2xl mx-auto">
      <HeroBurst :max="520" :intensity="1.2" class="mx-auto" />

      <h1 class="text-3xl font-bold mb-2">{{ $t('heroTitle') }}</h1>
      <p class="opacity-70 mb-6">{{ $t('heroSubtitle') }}</p>

      <div class="flex gap-2 justify-center">
        <input
          v-model="q"
          class="input input-bordered flex-1 max-w-xl"
          :placeholder="$t('searchPlaceholder')"
          @keyup.enter="runSearch"
        >
        <button class="btn btn-primary" @click="runSearch">
          {{ $t('search') || 'Suchen' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="opacity-70">{{ $t('loading') }}</div>

    <ul v-else-if="hits.length" class="max-w-3xl mx-auto space-y-3">
      <li v-for="row in hits" :key="row.id" class="card bg-base-100 border">
        <div class="card-body">
          <div class="flex items-start justify-between gap-4">
            <h3 class="card-title">
              <NuxtLink :to="`/entry/${row.kind}/${encodeURIComponent(row.id)}`">
                {{ row.title || row.title_de || row.name || row.id }}
              </NuxtLink>
              <span class="badge badge-outline ml-2">{{ row.kind }}</span>
            </h3>
            <div class="text-xs opacity-60 whitespace-nowrap">
              <span v-if="row.updatedAt && row.updatedAt !== 'Invalid Date'">{{ new Date(row.updatedAt).toLocaleDateString() }}</span>
              <span v-else-if="row.updated_at && row.updated_at !== 'Invalid Date'">{{ new Date(row.updated_at).toLocaleDateString() }}</span>
              <span v-else>-</span>
            </div>
          </div>

          <p class="w-full text-left line-clamp-3">
            {{ row.summary || row.summary_de || row.summary_en || row.topic || row.category || row.domain }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <NuxtLink
              v-if="row.id && row.kind && /^[a-zA-Z_]+$/.test(row.kind)"
              :to="`/entry/${row.kind}/${encodeURIComponent(row.id)}`"
              class="btn btn-sm btn-outline"
            >
              {{ $t('details') || 'Details' }}
            </NuxtLink>

            <a
              v-if="row.source_url"
              :href="row.source_url"
              target="_blank"
              rel="noopener"
              class="btn btn-sm btn-primary"
            >
              {{ $t('openSource') || 'Zur Quelle' }}
            </a>
          </div>
          <!-- Zeige alle Felder generisch -->
          <div v-if="row" class="mt-2 text-xs opacity-70 grid grid-cols-2 gap-2">
            <div v-for="(val, key) in row" :key="key">
              <strong>{{ key }}:</strong> {{ val }}
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
