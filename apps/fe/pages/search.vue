<template>
  <div>
    <FacetFilters v-model="filters" />
    <div v-if="pending">Lade...</div>
    <div v-if="error" class="text-red-600">{{ error }}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <EntityCard v-for="e in results" :key="e.id" v-bind="e">
        <template #actions>
          <NuxtLink
            :to="`/entities/${e.id}`"
            class="btn btn-primary btn-sm mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :aria-label="`Details zu ${e.titleDe || e.titleEn || e.titleSimpleDe || e.id}`"
          >
            Details ansehen
          </NuxtLink>
        </template>
      </EntityCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FacetFilters from '../components/FacetFilters.vue';
import EntityCard from '../components/EntityCard.vue';
import { useSearch } from '../composables/useSearch';

const route = useRoute();
const router = useRouter();
const filters = ref({ ...route.query });

watch(filters, v => {
  router.replace({ query: v });
}, { deep: true });

const { results, pending, error } = useSearch(filters.value);
</script>
