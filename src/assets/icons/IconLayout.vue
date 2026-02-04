<template>
  <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">

  <!-- License: GPL. Made by Themify: https://themify.me/terms -->
  <svg
    :width="width"
    :height="height"
    viewBox="0 0 17 17"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <path
      d="M0 0v17h17v-17h-17zM1 6h9v10h-9v-10zM16 16h-5v-10h5v10zM1 5v-4h15v4h-15z"
      :fill="color"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps({
  width: {
    type: String,
    default: "24px",
  },
  height: {
    type: String,
    default: "24px",
  },
  color: {
    type: String,
    default: "#ffffff",
  },
});
</script>
