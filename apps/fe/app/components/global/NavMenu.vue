<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchTopics, topicLabel  } from '@/composables/useTopics'
import type {TopicItem} from '@/composables/useTopics';
const items = ref<TopicItem[]>([])
const open = ref(false)
onMounted(async () => { items.value = (await fetchTopics(12)).topics })
</script>

<template>
  <nav class="navbar bg-base-100 border-b">
    <div class="container mx-auto px-4 flex items-center justify-between">
      <div class="flex-1">
        <NuxtLink to="/" class="text-xl font-semibold">Systemfehler</NuxtLink>
      </div>

      <div class="flex items-center gap-4">
        <div class="hidden md:flex items-center gap-4">
          <NuxtLink v-for="t in items" :key="t.topic" class="link link-hover" :to="`/topic/${t.topic}`">
            {{ topicLabel(t.topic) }}
            <span class="badge badge-ghost ml-1">{{ t.total }}</span>
          </NuxtLink>
        </div>

        <div class="md:hidden dropdown dropdown-end" :class="{ 'dropdown-open': open }">
          <label tabindex="0" class="btn btn-ghost" @click="open = !open">{{ $t('menu') }}</label>
          <ul tabindex="0" class="menu dropdown-content bg-base-100 rounded-box z-[1] w-64 p-2 shadow">
            <li v-for="t in items" :key="t.topic">
              <NuxtLink :to="`/topic/${t.topic}`" @click="open=false">
                {{ topicLabel(t.topic) }}
                <span class="badge badge-ghost ml-1">{{ t.total }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>

        <LanguageSwitch />
        <ThemeSwitch class="ml-1" />
      </div>
    </div>
  </nav>
</template>
