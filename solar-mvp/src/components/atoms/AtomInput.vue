<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    modelValue: string | number;
    placeholder?: string;
    type?: string;
    autofocus?: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'input', 'keyup.enter']);

const value = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

const onInput = (event: Event) => {
    emit('input', event);
};
</script>

<template>
    <input v-model="value" :type="type || 'text'" :placeholder="placeholder" :autofocus="autofocus" @input="onInput"
        @keyup.enter="$emit('keyup.enter')"
        class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none" />
</template>
