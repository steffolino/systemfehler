<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchTopics, topicLabel  } from '@/composables/useTopics'
import type {TopicItem} from '@/composables/useTopics';
import { useSearchFilterStore } from '@/stores/searchFilter';
const items = ref<TopicItem[]>([])
const open = ref(false)
const filterStore = useSearchFilterStore()
onMounted(async () => {
  const result = await fetchTopics(12)
  // Akzeptiere Array von Strings oder Array von Objekten
  if (Array.isArray(result)) {
    items.value = result.map(t => typeof t === 'string' ? { topic: t, total: undefined } : t)
  } else if (Array.isArray(result.topics)) {
    items.value = result.topics.map(t => typeof t === 'string' ? { topic: t, total: undefined } : t)
  } else {
    items.value = []
  }
})
</script>

<template>
  <nav class="navbar bg-base-100 border-b">
    <div class="container mx-auto px-4 flex items-center justify-between">
      <div class="flex-1">
        <NuxtLink to="/" class="text-xl font-semibold">Systemfehler</NuxtLink>
      </div>

      <div class="flex items-center gap-4">
        <div class="hidden md:flex items-center gap-4">
          <button
            v-for="t in items"
            :key="t.topic"
            class="link link-hover flex items-center"
            :class="{ 'font-bold text-primary': filterStore.topic === t.topic }"
            @click="filterStore.setTopic(t.topic)"
          >
            {{ topicLabel(t.topic) }}
            <span v-if="t.total !== undefined" class="badge badge-ghost ml-1">{{ t.total }}</span>
          </button>
        </div>

        <div class="md:hidden dropdown dropdown-end" :class="{ 'dropdown-open': open }">
          <label tabindex="0" class="btn btn-ghost" @click="open = !open">{{ $t('menu') }}</label>
          <ul tabindex="0" class="menu dropdown-content bg-base-100 rounded-box z-[1] w-64 p-2 shadow">
            <li v-for="t in items" :key="t.topic">
              <button
                class="w-full flex items-center"
                :class="{ 'font-bold text-primary': filterStore.topic === t.topic }"
                @click="filterStore.setTopic(t.topic); open=false"
              >
                {{ topicLabel(t.topic) }}
                <span v-if="t.total !== undefined" class="badge badge-ghost ml-1">{{ t.total }}</span>
              </button>
            </li>
          </ul>
        </div>

        <LanguageSwitch />
        <ThemeSwitch class="ml-1" />
      </div>
    </div>
  </nav>
</template>
