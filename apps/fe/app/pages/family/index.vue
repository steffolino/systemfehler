<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { searchEntries, suggest  } from '~/composables/useSearch'
import type {Hit} from '~/composables/useSearch';

const q = ref('kindergeld') // start with something useful
const topic = ref('family_benefits')
const hits = ref<Hit[]>([])
const loading = ref(false)
const suggestions = ref<{kind:string;id:string;title:string}[]>([])
const showSuggest = ref(false)
let t: ReturnType<typeof setTimeout> | null = null

async function runSearch() {
  loading.value = true
  try {
    const { hits: rows } = await searchEntries({ q: q.value, topic: topic.value, limit: 20 })
    hits.value = rows
    showSuggest.value = rows.length === 0
    if (rows.length === 0 && q.value.length >= 2) {
      const { suggestions: sug } = await suggest(q.value, topic.value)
      suggestions.value = sug
    } else {
      suggestions.value = []
    }
  } finally {
    loading.value = false
  }
}

function onInput() {
  showSuggest.value = false
  if (t) clearTimeout(t)
  t = setTimeout(async () => {
    if (q.value.trim().length < 2) { suggestions.value = []; return }
    const { suggestions: sug } = await suggest(q.value, topic.value)
    suggestions.value = sug
    showSuggest.value = true
  }, 180)
}

function pickSuggestion(s: {title:string}) {
  q.value = s.title
  showSuggest.value = false
  runSearch()
}

watch(() => topic.value, runSearch, { immediate: true })
watch(() => q.value, () => { /* we only search on Enter or suggestion pick */ })

const empty = computed(() => !loading.value && hits.value.length === 0)
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 space-y-4">
    <div class="text-2xl font-semibold">Familienleistungen</div>
    <div class="flex items-center gap-2">
      <input
        v-model="q"
        placeholder="Suche (z. B. Kindergeld, KiZ, Wohngeld)…"
        class="input input-bordered w-full"
        @input="onInput"
        @keyup.enter="runSearch" >
      <button class="btn btn-primary" @click="runSearch">Suchen</button>
    </div>

    <div v-if="showSuggest && suggestions.length" class="bg-base-200 rounded-xl p-3">
      <div class="text-sm mb-2 opacity-70">Meintest du:</div>
      <div class="flex flex-wrap gap-2">
        <button v-for="s in suggestions" :key="s.id" class="btn btn-sm" @click="pickSuggestion(s)">
          {{ s.title }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="opacity-70">Lade …</div>

    <div v-if="empty" class="opacity-70">
      Keine Treffer. Tipp: versuche <em>Kindergeld</em> oder <em>KiZ</em>.
    </div>

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
          <div class="flex items-center gap-2 text-xs opacity-70">
            <span v-if="row.source_domain">Quelle: {{ row.source_domain }}</span>
            <span v-if="row.language?.length">· Sprache: {{ row.language.join(', ') }}</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
