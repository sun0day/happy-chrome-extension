import {join} from 'node:path'
import {emitFile, targetToLoader} from './file'

export class ContentLoader {
  outDir: string
  target: string

  constructor(outDir: string, target: string) {
    this.outDir = outDir
    this.target = target
  }
  
  emit() {
    return emitFile(
      join(this.outDir, targetToLoader(this.target)), 
      `(async () => {
\tawait import(chrome.runtime.getURL("${this.target}"))
})()`
    )
  }
}


