<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const { t, locale } = useI18n()

const { data, error, pending } = await useAsyncData(
  `entry:${route.params.kind}:${route.params.id}`,
  async () => {
    try {
  // Use plural API route for all entity types
  let apiKind = route.params.kind;
  if (apiKind === 'organization') apiKind = 'organizations';
  if (apiKind === 'benefit') apiKind = 'benefits';
  if (apiKind === 'contact') apiKind = 'contacts';
  if (apiKind === 'service') apiKind = 'services';
  return await $fetch(`${config.public.apiBase}/api/${apiKind}/${route.params.id}`)
    } catch (e) {
      return null
    }
  }
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
    <div v-else-if="!data">{{ t('entry.notFound') }}</div>
    <div v-else>
      <h1 class="text-2xl font-semibold">{{ title || data.name || data.title }}</h1>
      <p v-if="summary" class="mt-2 text-left" dir="auto">{{ summary }}</p>
      <p v-else-if="data.summary">{{ data.summary }}</p>
      <p v-else-if="data.domain">{{ data.domain }}</p>

      <div v-if="data.topic || data.tags || data.language" class="mt-4 flex flex-wrap gap-2">
        <span v-if="data.topic" class="badge badge-outline">{{ t('entry.topic') }}: {{ Array.isArray(data.topic) ? data.topic.join(', ') : data.topic }}</span>
        <span v-if="data.tags" class="badge badge-outline">{{ t('entry.tags') }}: {{ Array.isArray(data.tags) ? data.tags.join(', ') : data.tags }}</span>
        <span v-if="data.language" class="badge badge-outline">{{ t('entry.language') }}: {{ Array.isArray(data.language) ? data.language.join(', ') : data.language }}</span>
      </div>

      <div v-if="data.source_url || data.url" class="mt-6">
        <a
          :href="data.source_url || data.url"
          target="_blank" rel="noopener"
          class="btn btn-primary">
          {{ t('entry.openSource') }}
        </a>
      </div>

      <div v-if="data.links?.length" class="mt-6">
        <h2 class="text-lg font-medium mb-2">{{ t('entry.links') }}</h2>
        <ul class="space-y-2">
          <li v-for="l in data.links" :key="l.id || l.url" class="flex items-start gap-2">
            <a :href="l.url" target="_blank" rel="noopener" class="link break-all">
              {{ l.title || l.url }}
            </a>
            <span v-if="l.relation" class="badge badge-ghost">{{ relationLabel(l.relation) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
