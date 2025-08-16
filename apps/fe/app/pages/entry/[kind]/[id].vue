<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const { t, locale } = useI18n()

const { data, error, pending } = await useAsyncData(
  `entry:${route.params.kind}:${route.params.id}`,
  () => $fetch(`${config.public.searchBase}/entry/${route.params.kind}/${route.params.id}`)
)

// pick the right content language with fallback
const title = computed(() => data.value?.[`title_${locale.value.startsWith('en') ? 'en' : 'de'}`] || data.value?.title_de || data.value?.title_en || '')
const summary = computed(() => data.value?.[`summary_${locale.value.startsWith('en') ? 'en' : 'de'}`] || data.value?.summary_de || data.value?.summary_en || '')

// map DB relations -> localized labels
function relationLabel(rel?: string) {
  if (!rel) return t('relation.other')
  const key = `relation.${rel}`
  const out = t(key)
  return out === key ? t('relation.other') : out
}
</script>

<template>
  <section class="container mx-auto p-4 max-w-3xl">
    <div v-if="pending">{{ t('entry.loading') }}</div>
    <div v-else-if="error">{{ t('entry.error') }}</div>
    <div v-else>
      <h1 class="text-2xl font-semibold">{{ title }}</h1>
      <p class="mt-2 text-left" dir="auto">{{ summary }}</p>

      <div class="flex gap-2 mt-4">
        <a
v-if="data.source_url"
           :href="data.source_url"
           target="_blank" rel="noopener"
           class="btn btn-primary">
          {{ t('entry.openSource') }}
        </a>
      </div>

      <div v-if="data.links?.length" class="mt-6">
        <h2 class="text-lg font-medium mb-2">{{ t('entry.links') }}</h2>
        <ul class="space-y-2">
          <li v-for="l in data.links" :key="l.id" class="flex items-start gap-2">
            <a :href="l.url" target="_blank" rel="noopener" class="link break-all">
              {{ l.title || l.url }}
            </a>
            <span class="badge badge-ghost">{{ relationLabel(l.relation) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
