<script setup lang="ts">
import CesiumMap from "@/components/maps/CesiumMap.vue";
import { ref, watch, computed } from "vue";
import { debounce } from "@/utils/debounce";
import AtomInput from "@/components/atoms/AtomInput.vue";
import AtomButton from "@/components/atoms/AtomButton.vue";
import AtomModal from "@/components/atoms/AtomModal.vue";

const isMapActive = ref(false);
const showAddressModal = ref(false);
const addressInput = ref("");
const searchAddress = ref("");
const suggestions = ref<any[]>([]);
const isSearching = ref(false);

const canGoToMap = computed(() => addressInput.value.trim().length > 0);

const openAddressModal = () => {
  showAddressModal.value = true;
};

const cancelSearch = () => {
  showAddressModal.value = false;
  suggestions.value = [];
};

const startMap = () => {
  if (canGoToMap.value) {
    searchAddress.value = addressInput.value;
    isMapActive.value = true;
    showAddressModal.value = false;
  }
};

const backToHome = () => {
  isMapActive.value = false;
  searchAddress.value = "";
  addressInput.value = "";
};

const fetchSuggestions = async (query: string) => {
  if (!query || query.length < 3) {
    suggestions.value = [];
    return;
  }

  isSearching.value = true;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
    );
    const data = await response.json();
    suggestions.value = data;
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    suggestions.value = [];
  } finally {
    isSearching.value = false;
  }
};

const onInput = debounce(() => {
  fetchSuggestions(addressInput.value);
}, 500);

const selectSuggestion = (suggestion: any) => {
  addressInput.value = suggestion.display_name;
  suggestions.value = [];
};

watch(addressInput, (newValue) => {
  if (!newValue) {
    suggestions.value = [];
  }
});
</script>

<template>
  <div class="w-full h-screen bg-slate-100 overflow-hidden relative">
    <!-- Landing State -->
    <div
      class="flex flex-col items-center justify-center h-full space-y-8 animate-fade-in"
    >
      <div class="text-center space-y-4">
        <h1 class="text-5xl font-bold text-slate-800 tracking-tight">
          Solar MVP
        </h1>
        <p class="text-lg text-slate-600">Plan your solar installation in 3D</p>
      </div>

      <AtomButton
        @click="openAddressModal"
        variant="custom"
        custom-class="group relative px-8 py-4 bg-indigo-600 text-white font-semibold rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
      >
        Start Project
        <span
          class="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-4 group-hover:ring-indigo-300/30 transition-all"
        ></span>
      </AtomButton>
    </div>

    <!-- Address Modal -->
    <div
      v-if="showAddressModal"
      class="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100 relative"
      >
        <h3 class="text-2xl font-bold text-slate-800 mb-6">Enter Location</h3>

        <div class="space-y-4 relative">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1"
              >Address or City</label
            >
            <div class="relative">
              <AtomInput
                v-model="addressInput"
                @input="onInput"
                @keyup.enter="startMap"
                placeholder="e.g. 1600 Amphitheatre Parkway"
                autofocus
              />
              <div v-if="isSearching" class="absolute right-3 top-3.5">
                <div
                  class="animate-spin h-5 w-5 border-2 border-indigo-500 rounded-full border-t-transparent"
                ></div>
              </div>

              <!-- Suggestions Dropdown -->
              <div
                v-if="suggestions.length > 0"
                class="absolute top-full left-0 z-20 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto overflow-hidden"
              >
                <ul class="py-1">
                  <li
                    v-for="(item, index) in suggestions"
                    :key="index"
                    @click="selectSuggestion(item)"
                    class="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-start gap-3 transition-colors text-left group"
                  >
                    <span
                      class="mt-1 text-slate-400 group-hover:text-indigo-500"
                      >📍</span
                    >
                    <span
                      class="text-sm text-slate-700 group-hover:text-slate-900 leading-snug"
                      >{{ item.display_name }}</span
                    >
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="flex space-x-3 pt-2">
            <AtomButton
              @click="cancelSearch"
              variant="secondary"
              custom-class="flex-1"
            >
              Cancel
            </AtomButton>
            <AtomButton
              @click="startMap"
              variant="primary"
              custom-class="flex-1"
              :disabled="!canGoToMap"
            >
              Go to Map
            </AtomButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Map Modal -->
    <AtomModal
      :isOpen="isMapActive"
      @close="backToHome"
      customClass="w-[90vw] h-[85vh] max-w-7xl p-0 overflow-hidden bg-slate-900"
    >
      <div class="w-full h-full relative">
        <CesiumMap :initial-address="searchAddress">
          <div class="absolute top-4 left-4 z-10">
            <AtomButton
              @click="backToHome"
              variant="glass"
              custom-class="flex items-center gap-2"
            >
              <span>←</span> Back
            </AtomButton>
          </div>
        </CesiumMap>
      </div>
    </AtomModal>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
