<template>
  <svg
    :fill="props.color"
    :width="props.width"
    :height="props.height"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zm-8 4.9l7 3.5v7.24l-7-3.5V9.08zm9 10.74v-7.24l7-3.5v7.24l-7 3.5z"
    />
  </svg>
</template>

<script setup lang="ts">
interface IconCubeProps {
  color?: string;
  width?: string;
  height?: string;
}

const props = withDefaults(defineProps<IconCubeProps>(), {
  color: "#ffffff",
  width: "24px",
  height: "24px",
});
</script>
