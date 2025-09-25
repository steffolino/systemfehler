<script setup lang="ts">
import { ref } from 'vue'
import { useTopics } from '@/composables/useTopics'
import { useRouter } from 'vue-router';
import { useSearchFilterStore } from '@/stores/searchFilter';
const open = ref(false)
const filterStore = useSearchFilterStore()
const router = useRouter();
const { topics } = useTopics();

function goToTopic(topic: string) {
  filterStore.setTopic(topic);
  router.push({ path: '/search', query: { topic } });
}
</script>

<template>
  <nav class="navbar bg-base-100 border-b shadow-sm" aria-label="Main navigation">
    <div class="container mx-auto px-4 flex items-center justify-between">
      <div class="flex-1">
        <NuxtLink to="/" class="text-xl font-bold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded" tabindex="0" aria-label="Systemfehler Home">Systemfehler</NuxtLink>
      </div>

      <div class="flex items-center gap-4">
        <div class="hidden md:flex items-center gap-4" role="menubar" aria-label="Topics">
          <button
            v-for="t in topics"
            :key="t"
            class="link link-hover flex items-center px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-100"
            :class="{ 'font-bold text-primary bg-primary/10': filterStore.topic === t }"
            :aria-current="filterStore.topic === t ? 'page' : undefined"
            role="menuitem"
            tabindex="0"
            @click="goToTopic(t)"
          >
            {{ t }}
          </button>
        </div>

        <div class="md:hidden dropdown dropdown-end" :class="{ 'dropdown-open': open }">
          <label tabindex="0" class="btn btn-ghost" aria-haspopup="true" :aria-expanded="open ? 'true' : 'false'" @click="open = !open">{{ $t('menu') }}</label>
          <ul tabindex="0" class="menu dropdown-content bg-base-100 rounded-box z-[1] w-64 p-2 shadow" role="menu" aria-label="Topics">
            <li v-for="t in topics" :key="t">
              <button
                class="w-full flex items-center px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :class="{ 'font-bold text-primary bg-primary/10': filterStore.topic === t }"
                :aria-current="filterStore.topic === t ? 'page' : undefined"
                role="menuitem"
                tabindex="0"
                @click="goToTopic(t); open=false"
              >
                {{ t }}
              </button>
            </li>
          </ul>
        </div>

        <LanguageSwitch aria-label="Sprache wechseln" />
        <ThemeSwitch class="ml-1" aria-label="Theme wechseln" />
      </div>
    </div>
  </nav>
</template>
