import { ref } from "vue";

export const AppStep = {
  SelectLocation: "SelectLocation",
  Drawing: "Drawing",
  ShapeReady: "ShapeReady",
  GroundHeightCalculated: "GroundHeightCalculated",
  ThreeDGenerated: "ThreeDGenerated",
} as const;

export type AppStep = (typeof AppStep)[keyof typeof AppStep];

export function useControlFlow() {
  // standard data of the whole flow
  const step = ref<AppStep>(AppStep.SelectLocation);

  const setStep = (newStep: AppStep) => {
    step.value = newStep;
  };

  const startDrawing = () => {
    step.value = AppStep.Drawing;
  };

  const finishDrawing = () => {
    step.value = AppStep.ShapeReady;
  };

  const reset = () => {
    step.value = AppStep.SelectLocation;
  };

  return {
    step,
    setStep,
    startDrawing,
    finishDrawing,
    reset,
    AppStep,
  };
}
