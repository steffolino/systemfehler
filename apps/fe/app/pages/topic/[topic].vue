<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, watchEffect } from 'vue'
import { searchEntries } from '@/composables/useSearch'
import { topicLabel } from '@/composables/useTopics'

const route = useRoute()
const topic = ref<string>(route.params.topic as string)
const q = ref((route.query.q as string) || '')
const hits = ref<any[]>([])
const loading = ref(false)
const offset = ref(0)
const limit = 20

async function load(reset=false) {
  loading.value = true
  try {
    if (reset) { offset.value = 0; hits.value = [] }
    const { hits: rows } = await searchEntries({ q: q.value, topic: topic.value, limit, offset: offset.value })
    hits.value = reset ? rows : hits.value.concat(rows)
    offset.value += rows.length
  } finally {
    loading.value = false
  }
}

watchEffect(() => {
  topic.value = route.params.topic as string
  q.value = (route.query.q as string) || ''
  load(true)
})
</script>

<template>
  <section class="container mx-auto px-4 py-6 space-y-4">
    <h1 class="text-2xl font-semibold">{{ topicLabel(topic) }}</h1>

    <div class="flex gap-2">
      <input
v-model="q" class="input input-bordered w-full" placeholder="In diesem Thema suchen…"
             @keyup.enter="load(true)">
      <button class="btn" @click="load(true)">Suchen</button>
    </div>

    <div v-if="loading && !hits.length" class="opacity-70">Lade …</div>

    <ul class="space-y-3">
      <li v-for="row in hits" :key="row.id" class="card bg-base-100 border">
        <div class="card-body">
          <div class="flex items-start justify-between gap-4">
            <h3 class="card-title">
              {{ row.title_de }}
              <span class="badge badge-outline ml-2">{{ row.kind }}</span>
            </h3>
            <div class="text-xs opacity-60 whitespace-nowrap">
              {{ new Date(row.updated_at).toLocaleDateString() }}
            </div>
          </div>
          <p class="line-clamp-3">{{ row.summary_de || row.summary_en }}</p>
          <!-- If you add source_url to MV later, you can link out here -->
        </div>
      </li>
    </ul>

    <div v-if="hits.length && !loading" class="flex justify-center">
      <button class="btn btn-outline" @click="load()">Mehr laden</button>
    </div>

    <div v-if="!loading && !hits.length" class="opacity-70">
      Keine Treffer. Tipp: versuche einen kürzeren Begriff oder eine andere Schreibweise.
    </div>
  </section>
</template>
