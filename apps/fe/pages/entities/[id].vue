<template>
  <div>
    <div v-if="pending">Lade...</div>
    <div v-if="error" class="text-red-600">{{ error }}</div>
    <EntityDetail v-if="entity" :entity="entity" />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import EntityDetail from '../../components/EntityDetail.vue';
import { useEntity } from '../../composables/useEntity';

const route = useRoute();
const id = route.params.id as string;
const lang = route.query.lang as string | undefined;
const { entity, pending, error } = useEntity({ id, lang });
</script>
