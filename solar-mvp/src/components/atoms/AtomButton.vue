<script setup lang="ts">
import { computed } from 'vue';

type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'custom';

const props = withDefaults(defineProps<{
    variant?: ButtonVariant;
    customClass?: string;
}>(), {
    variant: 'primary',
    customClass: ''
});

const baseClasses = "font-medium transition-all focus:outline-none";

const variantClasses = computed(() => {
    switch (props.variant) {
        case 'primary':
            return "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-200 shadow-lg shadow-indigo-200 rounded-xl px-4 py-3";
        case 'secondary':
            return "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3";
        case 'glass':
            return "bg-white/90 backdrop-blur text-slate-800 shadow hover:bg-white rounded-lg px-4 py-2";
        case 'custom':
            return "";
        default:
            return "";
    }
});
</script>

<template>
    <button :class="[baseClasses, variantClasses, customClass]">
        <slot></slot>
    </button>
</template>
