export const motionTiming = {
  control: 0.2,
  menu: 0.24,
  drawer: 0.26,
  press: 0.12,
  feedback: 0.15,
} as const

export const motionEase = {
  enter: [0.22, 1, 0.36, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
}
