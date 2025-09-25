<template>
  <div class="facet-filters flex flex-wrap gap-2 items-end">
    <input v-model="model.q" placeholder="Suche..." class="input input-bordered" >
    <select v-model="model.category" class="select select-bordered">
      <option value="">Kategorie</option>
      <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
    </select>
    <select v-model="model.status" class="select select-bordered">
      <option value="">Status</option>
      <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
    </select>
    <select v-model="model.topic" class="select select-bordered">
      <option value="">Thema</option>
      <option v-for="t in topics" :key="t" :value="t">{{ t }}</option>
    </select>
    <select v-model="model.lang" class="select select-bordered">
      <option value="de">Deutsch</option>
      <option value="de_simple">Einfache Sprache</option>
      <option value="en">Englisch</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useTopics } from '../composables/useTopics';
import type { Lang } from '../lib/lang';

const props = defineProps<{ modelValue: { q?: string; category?: string; status?: string; topic?: string; lang?: Lang } }>();
const emit = defineEmits(['update:modelValue']);

const model = ref({ ...props.modelValue });

watch(model, v => emit('update:modelValue', v), { deep: true });
watch(() => props.modelValue, v => Object.assign(model.value, v));

const categories = ["organization","service","tool","form","glossary","legal_aid","association"];
const statuses = ["unverified","auto_processed","verified"];
const { topics } = useTopics();
</script>
