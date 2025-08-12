<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3001'
const route = useRoute()
const router = useRouter()

// ------- Query state (URL-backed) -------
const q = ref<string>((route.query.q as string) || '')
const topic = ref<string>((route.query.topic as string) || '')
const status = ref<string>((route.query.status as string) || '')
const sort = ref<string>((route.query.sort as string) || 'title')
const dir = ref<'asc' | 'desc'>(((route.query.dir as string) || 'asc') as 'asc' | 'desc')

// Keep URL in sync
watch([q, topic, status, sort, dir], () => {
  router.replace({
    query: {
      ...(q.value ? { q: q.value } : {}),
      ...(topic.value ? { topic: topic.value } : {}),
      ...(status.value ? { status: status.value } : {}),
      ...(sort.value && sort.value !== 'title' ? { sort: sort.value } : {}),
      ...(dir.value !== 'asc' ? { dir: dir.value } : {}),
    }
  })
})

// React to back/forward
watch(() => route.query, (newQ) => {
  q.value = (newQ.q as string) || ''
  topic.value = (newQ.topic as string) || ''
  status.value = (newQ.status as string) || ''
  sort.value = (newQ.sort as string) || 'title'
  dir.value = ((newQ.dir as string) || 'asc') as 'asc' | 'desc'
})

// ------- Data load -------
const { data: all, pending, error } = await useAsyncData('benefitsAll', () =>
  $fetch<any[]>(`${apiBase}/api/benefits`)
)

// ------- Filter options -------
const topics = computed<string[]>(() => {
  const set = new Set<string>()
  for (const x of all.value || []) if (x?.topic) set.add(String(x.topic))
  return Array.from(set).sort()
})

const statuses = computed<string[]>(() => {
  const set = new Set<string>()
  for (const x of all.value || []) if (x?.status) set.add(String(x.status))
  return Array.from(set).sort()
})

// ------- Filter + Search + Sort -------
const rows = computed(() => {
  let list = (all.value || []).map((item: any, idx: number) => ({ ...item, __i: idx }))

  const term = q.value.trim().toLowerCase()
  if (term) {
    list = list.filter(x =>
      [x.title, x.h1, x.source, x.topic, x.url, x.meta_description, x.excerpt]
        .some(v => String(v || '').toLowerCase().includes(term))
    )
  }

  if (topic.value)  list = list.filter(x => String(x.topic || '')  === topic.value)
  if (status.value) list = list.filter(x => String(x.status || '') === status.value)

  const key = sort.value as keyof typeof list[number]
  list.sort((a, b) => {
    const av = String(a?.[key] ?? '').toLowerCase()
    const bv = String(b?.[key] ?? '').toLowerCase()
    if (av < bv) return dir.value === 'asc' ? -1 : 1
    if (av > bv) return dir.value === 'asc' ? 1 : -1
    return 0
  })

  return list
})

function statusBadgeClass(st: string) {
  switch (st) {
    case 'ok':         return 'badge badge-success'
    case 'not_found':  return 'badge badge-error'
    case 'error':      return 'badge badge-warning'
    default:           return 'badge badge-neutral'
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Toolbar -->
    <div class="sticky top-0 z-10 bg-base-100/90 backdrop-blur border-b border-base-200">
      <div class="max-w-full py-3 flex flex-wrap items-end gap-3">
        <!-- Search -->
        <label class="form-control w-full sm:w-72">
          <div class="label"><span class="label-text">{{ $t('search') }}</span></div>
          <div class="join w-full">
            <input
              v-model="q"
              type="text"
              :placeholder="$t('searchPlaceholder')"
              class="input input-bordered join-item w-full"
            >
            <button
              class="btn btn-square btn-outline join-item"
              type="button"
              :disabled="!q"
              :aria-label="$t('clearSearch')"
              :title="$t('clearSearch')"
              @click="q = ''"
            >
              <Icon name="heroicons:x-mark-20-solid" />
            </button>
          </div>
        </label>

        <!-- Topic filter -->
        <label class="form-control w-full sm:w-60">
          <div class="label"><span class="label-text">{{ $t('topic') }}</span></div>
          <select v-model="topic" class="select select-bordered">
            <option value="">{{ $t('allTopics') }}</option>
            <option v-for="t in topics" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <!-- Status filter -->
        <label class="form-control w-full sm:w-56">
          <div class="label"><span class="label-text">{{ $t('status') }}</span></div>
          <select v-model="status" class="select select-bordered">
            <option value="">{{ $t('allStatus') }}</option>
            <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>

        <!-- Sort & dir -->
        <label class="form-control w-full sm:w-56">
          <div class="label"><span class="label-text">{{ $t('sortBy') }}</span></div>
          <select v-model="sort" class="select select-bordered">
            <option value="title">{{ $t('sortTitle') }}</option>
            <option value="source">{{ $t('sortSource') }}</option>
            <option value="topic">{{ $t('sortTopic') }}</option>
            <option value="status">{{ $t('sortStatus') }}</option>
          </select>
        </label>

        <div class="form-control">
          <div class="label"><span class="label-text">&nbsp;</span></div>
          <button
            class="btn btn-outline"
            type="button"
            :aria-label="dir === 'asc' ? $t('changeToDescending') : $t('changeToAscending')"
            @click="dir = dir === 'asc' ? 'desc' : 'asc'"
          >
            <Icon v-if="dir === 'asc'" name="heroicons:arrow-up-20-solid" />
            <Icon v-else name="heroicons:arrow-down-20-solid" />
            {{ dir === 'asc' ? $t('asc') : $t('desc') }}
          </button>
        </div>

        <!-- Reset -->
        <div class="ms-auto">
          <div class="label"><span class="label-text">&nbsp;</span></div>
          <button
            class="btn btn-ghost"
            type="button"
            @click="q=''; topic=''; status=''; sort='title'; dir='asc'"
          >
            {{ $t('reset') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-if="pending" class="flex items-center gap-3 text-base-content/70">
      <span class="loading loading-spinner" /> {{ $t('loading') }}
    </div>
    <div v-else-if="error" class="alert alert-error">
      <span class="font-semibold">{{ $t('failedToLoad') }}</span>
    </div>

    <div v-else>
      <div class="overflow-x-auto rounded-box border border-base-300">
        <table class="table table-zebra">
          <thead class="bg-base-200">
            <tr>
              <th>{{ $t('title') }}</th>
              <th>{{ $t('source') }}</th>
              <th>{{ $t('topic') }}</th>
              <th>{{ $t('status') }}</th>
              <th/>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.__i" class="hover">
              <td class="align-top">
                <NuxtLink :to="`/benefits/${row.__i}`" class="link link-primary">
                  {{ row.title || row.h1 || row.url }}
                </NuxtLink>
                <div v-if="row.meta_description" class="text-sm text-base-content/70 line-clamp-2 mt-1">
                  {{ row.meta_description }}
                </div>
              </td>
              <td class="align-top">{{ row.source || '—' }}</td>
              <td class="align-top">
                <div class="badge badge-outline">{{ row.topic || '—' }}</div>
              </td>
              <td class="align-top">
                <span :class="statusBadgeClass(row.status)">
                  {{ row.status || '—' }}
                </span>
              </td>
              <td class="align-top text-right">
                <div class="flex gap-2 justify-end">
                  <NuxtLink :to="`/benefits/${row.__i}`" class="btn btn-sm btn-primary">
                    {{ $t('open') }}
                  </NuxtLink>
                  <a :href="row.url" target="_blank" class="btn btn-sm btn-ghost" rel="noopener">
                    <Icon name="heroicons:arrow-top-right-on-square-20-solid" />
                  </a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!rows.length" class="text-base-content/70 mt-4 flex items-center gap-2">
        <Icon name="heroicons:information-circle-20-solid" />
        {{ $t('noResults') }}
      </p>
    </div>
  </div>
</template>
