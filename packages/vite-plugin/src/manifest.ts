import {join, resolve} from "path"
import merge from 'lodash.merge'
import {readJsonSync, targetToLoader, writeJsonSync} from "./file"
import {ModuleFile} from "./types"

const MANIFEST = 'manifest.json'

export class Manifest {
  manifest: chrome.runtime.ManifestV3
  outDir: string
  root: string

  constructor(root: string, outDir: string, manifest?: chrome.runtime.ManifestV3) {
    this.root = root
    this.outDir = outDir
    this.manifest = manifest ?? readJsonSync(resolve(root, MANIFEST));
  }


  // create a real manifest to outDir
  create(urlMap: Map<string, ModuleFile>) {
    let contentScripts = this.manifest['content_scripts'] ?? []
    const webAccessResources = this.manifest['web_accessible_resources']?.slice() ?? []

    // add permission for dev assets emissions
    webAccessResources.push(...contentScripts.map(({ matches }) => ({
      matches: matches ?? ["<all_urls>"],
      resources: ["**/*", "*"],
      use_dynamic_url: true 
    })))

    // replace js entries in content_scripts
    contentScripts = contentScripts.map((script) => {
      if(!script.js) {
        return script 
      }
      
      return {
        ...script,
        js: script.js.map(jsFile => targetToLoader(urlMap.get(jsFile)!.target)) ?? []
      }
    })

    const newManifest =  merge({}, this.manifest, {
      content_scripts: contentScripts,
      web_accessible_resources: webAccessResources
    })

    writeJsonSync(join(this.outDir, MANIFEST), newManifest)
  }

  // get all entries from manifest
  getEntries() {
    return (this.manifest['content_scripts'] ?? []).reduce(
        (jsFiles, {js}) => jsFiles.concat(js ?? []), 
      [] as string[]
      )
  }

  // get all content script target files
  getContentTargets(urlMap: Map<string, ModuleFile>) {
    const contentScripts = this.manifest['content_scripts'] ?? []

    return contentScripts.reduce((targets, script) => {
      if(!script.js) {
        return  targets
      }
      return targets.concat(
        script.js.map(jsFile => urlMap.get(jsFile)!.target) ?? []
      )
    }, [] as string[])
  }
}
