<script setup lang="ts">
import { ref } from 'vue'
import { searchEntries } from '~/composables/useSearch' // if you added it earlier
const q = ref('')
const hits = ref<any[]>([])
const loading = ref(false)

async function runSearch() {
  loading.value = true
  try { hits.value = (await searchEntries({ q: q.value, limit: 10 })).hits }
  finally { loading.value = false }
}
</script>

<template>
  <section class="container mx-auto px-4 py-4 space-y-4 text-center">
    <div class="max-w-2xl mx-auto">
            <HeroBurst :max="120" class="mx-auto" />

      <h1 class="text-3xl font-bold mb-2">{{ $t('heroTitle') }}</h1>
      <p class="opacity-70 mb-6">{{ $t('heroSubtitle') }}</p>
      <div class="flex gap-2 justify-center">
        <input
v-model="q" class="input input-bordered w-full max-w-xl" :placeholder="$t('searchPlaceholder')"
               @keyup.enter="runSearch">
        <button class="btn btn-primary" @click="runSearch">{{ $t('search') || 'Suchen' }}</button>
      </div>
    </div>

    <!-- (Optional) your big SVG hero component here -->
    <!-- <HeroSearchBurst /> -->

    <div v-if="loading" class="opacity-70">{{ $t('loading') }}</div>
    <ul v-else-if="hits.length" class="max-w-3xl mx-auto space-y-3">
      <li v-for="row in hits" :key="row.id" class="card bg-base-100 border">
  <div class="card-body">
    <div class="flex items-start justify-between gap-4">
      <h3 class="card-title">
        <NuxtLink :to="`/entry/${row.kind}/${encodeURIComponent(row.id)}`">
          {{ row.title_de }}
        </NuxtLink>
        <span class="badge badge-outline ml-2">{{ row.kind }}</span>
      </h3>
      <div class="text-xs opacity-60 whitespace-nowrap">
        {{ new Date(row.updated_at).toLocaleDateString() }}
      </div>
    </div>

    <p class="w-full text-left line-clamp-3">
      {{ row.summary_de || row.summary_en }}
    </p>

    <div class="mt-3 flex flex-wrap gap-2">
      <NuxtLink
        :to="`/entry/${row.kind}/${encodeURIComponent(row.id)}`"
        class="btn btn-sm btn-outline"
      >
        {{ $t('details') || 'Details' }}
      </NuxtLink>

      <a
v-if="row.source_url"
         :href="row.source_url"
         target="_blank" rel="noopener"
         class="btn btn-sm btn-primary">
        {{ $t('openSource') || 'Zur Quelle' }}
      </a>
    </div>
  </div>
</li>
    </ul>
  </section>
</template>
