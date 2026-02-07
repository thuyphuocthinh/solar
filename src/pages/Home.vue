<script setup lang="ts">
import CesiumMap from "@/components/maps/CesiumMap.vue";
import { ref, watch, computed, onUnmounted } from "vue";
import { debounce } from "@/utils/debounce";
import AtomInput from "@/components/atoms/AtomInput.vue";
import AtomButton from "@/components/atoms/AtomButton.vue";
import AtomModal from "@/components/atoms/AtomModal.vue";
import AtomIcon from "@/components/atoms/AtomIcon.vue";
import AtomNotFound from "@/components/atoms/AtomNotFound.vue";
import heroBg from "@/assets/hero-bg.png";
import RecreateHouse3d from "@/components/maps/RecreateHouse3d.vue";
import type { HouseData } from "@/composables/useThreeJs";

const isMapActive = ref(false);
const showAddressModal = ref(false);
const addressInput = ref("");
const searchAddress = ref("");
const suggestions = ref<any[]>([]);
const isSearching = ref(false);
const house3dData = ref<HouseData | null>(null);
const searchCoordinates = ref<{ longitude: number; latitude: number } | null>(
  null,
);

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
  searchCoordinates.value = null;
  addressInput.value = "";
};

const fetchSuggestions = async (query: string) => {
  if (!query) {
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
  console.log("suggestion: ", suggestion);
  addressInput.value = suggestion.display_name;
  suggestions.value = [];

  // Extract lat/lon from suggestion
  if (suggestion.lat && suggestion.lon) {
    searchCoordinates.value = {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    };
  }
  startMap();
};

watch(addressInput, (newValue) => {
  if (!newValue) {
    suggestions.value = [];
  }
});

const features = [
  {
    icon: "IconLocation",
    title: "Locate",
    desc: "Instant address search with global coverage.",
  },
  {
    icon: "IconHome",
    title: "Design",
    desc: "Precision 3D roof modeling and panel placement.",
  },
  {
    icon: "IconBolt",
    title: "Analyze",
    desc: "Calculate potential energy generation tailored to you.",
  },
];

const clearAll = () => {
  house3dData.value = null;
  searchAddress.value = "";
  searchCoordinates.value = null;
  addressInput.value = "";
  suggestions.value = [];
  isSearching.value = false;
  isMapActive.value = false;
};

watch(isMapActive, (newVal: boolean) => {
  if (!newVal) {
    clearAll();
  }
});

onUnmounted(() => {
  clearAll();
});
</script>

<template>
  <div
    class="relative w-full h-screen bg-slate-900 font-sans selection:bg-indigo-500 selection:text-white"
  >
    <!-- Background Image with Overlay -->
    <div class="absolute inset-0 z-0">
      <img :src="heroBg" alt="Solar Home" class="w-full h-full object-cover" />
      <div
        class="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-transparent"
      ></div>
    </div>

    <!-- Main Content -->
    <div
      class="relative z-10 flex flex-col h-full container mx-auto px-6 py-12"
    >
      <!-- Navbar Placeholder (Logo) -->
      <nav class="flex items-center justify-between mb-16 animate-fade-in-down">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold"
          >
            S
          </div>
          <span class="text-xl font-bold text-white tracking-wide"
            >SolarMVP</span
          >
        </div>
      </nav>

      <!-- Hero Text -->
      <div
        class="flex-1 flex flex-col justify-center max-w-2xl animate-fade-in-up"
      >
        <h1
          class="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200 tracking-tight leading-tight mb-6"
        >
          Power Your Future <br />
          with Solar.
        </h1>
        <p
          class="text-lg md:text-xl text-slate-300 mb-8 max-w-lg leading-relaxed"
        >
          Design, analyze, and optimize your solar installation in 3D.
          Experience the future of energy independence today.
        </p>

        <div class="flex flex-col sm:flex-row gap-4">
          <AtomButton
            @click="openAddressModal"
            variant="custom"
            custom-class="group flex items-center gap-2 relative px-8 py-4 bg-indigo-600 text-white font-semibold rounded-full shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:bg-indigo-500 hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transition-all duration-300 transform hover:-translate-y-1"
          >
            Start Drawing
            <AtomIcon
              name="IconArrowRight"
              :width="'16px'"
              :height="'16px'"
              color="white"
            />
          </AtomButton>

          <AtomButton
            variant="custom"
            custom-class="px-8 py-4 bg-white/10 text-white font-medium rounded-full backdrop-blur-md hover:bg-white/20 transition-all border border-white/10"
          >
            Learn More
          </AtomButton>
        </div>
      </div>

      <!-- Feature Cards -->
      <div
        class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 animate-fade-in-up"
        style="animation-delay: 0.2s"
      >
        <div
          v-for="(feature, idx) in features"
          :key="idx"
          class="p-6 rounded-2xl bg-slate-800/40 backdrop-blur-md border border-white/5 hover:border-indigo-500/30 hover:bg-slate-800/60 transition-all duration-300 group"
        >
          <div
            class="mb-4 text-slate-400 group-hover:text-indigo-400 transition-all duration-300"
          >
            <AtomIcon :name="feature.icon" size="32" />
          </div>
          <h3 class="text-xl font-bold text-white mb-2">{{ feature.title }}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">
            {{ feature.desc }}
          </p>
        </div>
      </div>
    </div>

    <!-- Address Modal -->
    <AtomModal
      :isOpen="showAddressModal"
      @close="cancelSearch"
      customClass="!bg-white/90 backdrop-blur-xl max-w-lg border border-white/20 !overflow-visible"
    >
      <template #header>
        <h3 class="text-2xl font-bold text-slate-800">Search locations</h3>
      </template>

      <div class="p-8 h-[400px] overflow-y-auto">
        <p class="text-slate-500 mb-6 text-sm">
          Enter your address to begin the 3D modeling process.
        </p>

        <div class="space-y-4 relative">
          <div>
            <div class="relative">
              <div
                class="absolute top-3 left-0 pl-3 flex items-center pointer-events-none"
              >
                <AtomIcon
                  :name="'IconSearch'"
                  class="text-slate-400"
                  :size="'16'"
                />
              </div>
              <AtomInput
                v-model="addressInput"
                @input="onInput"
                @keyup.enter="onInput"
                placeholder="Search address, city, or zip..."
                autofocus
                class="pl-10 h-12 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg w-full bg-slate-50"
              />
              <div v-if="isSearching" class="absolute right-3 top-3.5">
                <div
                  class="animate-spin h-5 w-5 border-2 border-indigo-500 rounded-full border-t-transparent"
                ></div>
              </div>

              <!-- Suggestions Dropdown -->
              <div
                v-if="suggestions.length > 0"
                class="absolute top-full left-0 z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto overflow-hidden animate-slide-up"
              >
                <ul class="py-1">
                  <li
                    v-for="(item, index) in suggestions"
                    :key="index"
                    @click="selectSuggestion(item)"
                    class="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors text-left group border-b border-slate-50 last:border-0"
                  >
                    <div class="mt-1">
                      <AtomIcon
                        :name="'IconLocation'"
                        size="18"
                        class="text-slate-400 group-hover:text-indigo-500 transition-colors"
                      />
                    </div>
                    <span
                      class="text-sm text-slate-700 group-hover:text-slate-900 leading-snug"
                      >{{ item.display_name }}</span
                    >
                  </li>
                </ul>
              </div>

              <AtomNotFound
                v-else
                title="No location found"
                message="Please check your spelling or try a different address."
                icon="IconSearch"
              />
            </div>
          </div>
        </div>
      </div>
    </AtomModal>

    <!-- Map Modal -->
    <AtomModal
      :isOpen="isMapActive"
      @close="backToHome"
      customClass="w-full h-[90vh] max-w-full p-0 overflow-hidden bg-slate-900 rounded-xl"
    >
      <template #header>
        <h3 class="text-2xl font-bold text-slate-800">Map</h3>
      </template>
      <div class="w-full h-full relative overflow-hidden">
        <CesiumMap
          v-if="!house3dData"
          :initial-address="searchAddress"
          :initial-coordinates="searchCoordinates"
          @show-house3d="
            (data: HouseData) => {
              console.log('data: ', data);
              house3dData = data;
            }
          "
        />
        <!-- Recreate Roof 3D will be here -->
        <RecreateHouse3d v-if="house3dData" :house-data="house3dData" />
      </div>
    </AtomModal>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.6s ease-out;
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out backwards;
}

.animate-fade-in-down {
  animation: fadeInDown 0.8s ease-out backwards;
}

.animate-slide-up {
  animation: slideUp 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
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
