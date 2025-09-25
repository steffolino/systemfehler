<template>
  <div class="card bg-base-100 shadow-xl max-w-2xl mx-auto my-8 p-0" tabindex="0">
    <div class="card-body p-6">
      <div class="flex items-center gap-2 mb-2">
        <span class="badge badge-info badge-lg px-3 py-2 text-xs font-semibold"><span class="material-symbols-outlined align-middle mr-1">info</span>{{ entity.type }}</span>
        <StatusBadge :status="entity.status" :last-checked="entity.last_checked" />
      </div>
      <header class="mb-4">
        <h1 class="card-title text-2xl leading-tight mb-1">{{ entity.titleDe || entity.titleEn || entity.titleSimpleDe || entity.id }}</h1>
        <div class="text-base text-base-content/80 mb-2">{{ entity.summaryDe || entity.summaryEn || entity.summarySimpleDe }}</div>
        <div v-if="entity.url" class="text-xs text-blue-700 underline"><a :href="entity.url" target="_blank" rel="noopener">Zur Website</a></div>
      </header>
      <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mb-4">
        <template v-if="entity.language">
          <dt class="font-semibold">Sprache</dt>
          <dd>{{ entity.language }}</dd>
        </template>
        <template v-if="entity.topic">
          <dt class="font-semibold">Thema</dt>
          <dd>{{ entity.topic }}</dd>
        </template>
        <template v-if="entity.keywords">
          <dt class="font-semibold">Schlagwörter</dt>
          <dd>{{ entity.keywords.join(', ') }}</dd>
        </template>
        <template v-if="entity.domain">
          <dt class="font-semibold">Domain</dt>
          <dd>{{ entity.domain }}</dd>
        </template>
        <template v-if="entity.status">
          <dt class="font-semibold">Status</dt>
          <dd>{{ entity.status }}</dd>
        </template>
        <template v-if="entity.last_checked">
          <dt class="font-semibold">Zuletzt geprüft</dt>
          <dd>{{ entity.last_checked }}</dd>
        </template>
        <template v-if="entity.updatedAt">
          <dt class="font-semibold">Aktualisiert</dt>
          <dd>{{ entity.updatedAt }}</dd>
        </template>
      </dl>
      <section v-if="entity.grounding_snippets">
        <h2 class="font-semibold mt-4 mb-2 text-lg">Warum ist das wichtig?</h2>
        <ul class="list-disc pl-5">
          <li v-for="s in entity.grounding_snippets" :key="s.page_url">
            <a :href="s.page_url" target="_blank" rel="noopener" class="link link-primary">{{ s.snippet }}</a>
            <span v-if="s.prominence"> ({{ s.prominence }})</span>
          </li>
        </ul>
      </section>
      <section v-if="entity.related_links">
        <h2 class="font-semibold mt-4 mb-2 text-lg">Mehr erfahren</h2>
        <ul class="list-disc pl-5">
          <li v-for="l in entity.related_links" :key="l.url">
            <a :href="l.url" target="_blank" rel="noopener" class="link link-primary">{{ l.label || l.url }}</a>
          </li>
        </ul>
      </section>
      <section v-if="entity.content" class="mt-4">
        <h2 class="font-semibold mb-2 text-lg">Details</h2>
        <div class="prose max-w-none" v-html="entity.content"/>
      </section>
      <footer class="mt-6 text-xs text-gray-400 flex items-center gap-2">
        <span>Status zuletzt geprüft:</span>
        <StatusBadge :status="entity.status" :last-checked="entity.last_checked" />
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue';
import type { Entity, EntityDetail } from '../types/systemfehler.schema';

defineProps<{ entity: Entity | EntityDetail }>();
</script>
