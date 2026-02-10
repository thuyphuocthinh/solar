<template>
  <Suspense>
    <component
      :is="iconComponent"
      :id="id"
      :width="props.width"
      :height="props.height"
      :color="props.color"
      @click="handleClick"
    />
    <template #fallback>
      <div
        :style="{
          width: widthStyle,
          height: heightStyle,
        }"
        class="bg-slate-200 animate-pulse rounded"
      ></div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from "uuid";
import {
  defineAsyncComponent,
  onMounted,
  watch,
  shallowRef,
  computed,
} from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    width?: string | number;
    height?: string | number;
    stroke?: string;
    color?: string;
  }>(),
  {
    width: 24,
    height: 24,
  },
);

const emit = defineEmits(["click"]);

const id = uuidv4();
const iconComponent = shallowRef<any>(null);

const widthStyle = computed(() =>
  typeof props.width === "number" ? `${props.width}px` : props.width,
);
const heightStyle = computed(() =>
  typeof props.height === "number" ? `${props.height}px` : props.height,
);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

watch(
  () => props.name,
  (newName) => {
    if (!newName) return;
    const componentName = `${capitalize(newName)}`;

    try {
      iconComponent.value = defineAsyncComponent(
        () => import(`@/assets/icons/${componentName}.vue`),
      );
    } catch (e) {
      console.error(`Icon ${componentName} not found`, e);
    }
  },
  { immediate: true },
);

const handleClick = (event: Event) => {
  emit("click", event);
};

onMounted(() => {
  // Wait for next tick/suspense resolution if needed, but for ID-based styling:
  // Note: defineAsyncComponent is async, element might not be in DOM immediately.
  // The user's code attaches listener manually.
  // We kept the @click on component which is more Vue-like, but for strict adherence to user's 'element.addEventListener' pattern:
  // We can try to find it.
  // However, `handleClick` via @click is safer.
  // We will keep the user's manual style application if they really want it.

  const element = document.getElementById(id);
  if (element && props.stroke) {
    element.style.stroke = props.stroke;
  }
});

// Since we used @click in template, we don't STRICTLY need manual addEventListener,
// but if the SVG doesn't emit click (it should if it's root), it's fine.
// We will stick to the template @click for reliability.
</script>
