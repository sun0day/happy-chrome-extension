(async () => {
  const src = chrome.runtime.getURL('src/main.tsx.js')

  await import(src)
})()
