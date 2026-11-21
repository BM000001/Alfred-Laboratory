export function isRemoteStudyPreview() {
  return import.meta.env.MODE === 'studies-preview' && window.location.protocol === 'https:' &&
    import.meta.env.VITE_ALFRED_STUDIES_PREVIEW_ORIGIN === window.location.origin;
}
