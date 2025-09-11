import { defineStore } from 'pinia'

export const useSearchFilterStore = defineStore('searchFilter', {
  state: () => ({
    topic: null as string | null,
    // weitere Filter können hier ergänzt werden
  }),
  actions: {
    setTopic(topic: string | null) {
      (this as any).topic = topic
    },
    clearTopic() {
      (this as any).topic = null
    }
  }
})
