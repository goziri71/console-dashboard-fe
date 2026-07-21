let stepUpHandler = null
let pendingStepUp = null

export function registerMfaStepUpHandler(handler) {
  stepUpHandler = handler
  return () => {
    if (stepUpHandler === handler) stepUpHandler = null
  }
}

export function requestMfaStepUp() {
  if (pendingStepUp) return pendingStepUp
  if (!stepUpHandler) {
    return Promise.reject(new Error('MFA verification is unavailable.'))
  }

  pendingStepUp = Promise.resolve()
    .then(() => stepUpHandler())
    .finally(() => {
      pendingStepUp = null
    })
  return pendingStepUp
}
