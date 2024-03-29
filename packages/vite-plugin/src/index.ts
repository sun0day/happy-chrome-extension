import {normalizePath, type PluginOption, type Rollup} from 'vite'
import { 
  NODE_MODULES,
  SLASH,
  VIRTUAL_DIR, 
  VITE_CLIENT, createDir, emitFile, exist, fileToUrl, redirectFile, idToTarget, rm, DOT, relativePath } from './file'
import {isAbsolute, join, relative, sep} from 'node:path'
import {symlink} from 'node:fs/promises'
import { init as lexerInit , parse as parseESM } from 'es-module-lexer'
import MagicString, {SourceMap} from 'magic-string'
import {ModuleFile, PluginCrxOptions} from './types'
import './manifest'
import {Manifest} from './manifest'
import {ContentLoader} from './content-loader'

const urlMaps = new WeakMap<PluginCrxOptions, Map<string, ModuleFile>>()

export default (options: PluginCrxOptions = {}): PluginOption => {
	let root: string = ''
	let outDir: string = ''
  let nodeModulesRoot: string = ''
  let nodeModulesShadow: string = ''
  let virtualDir: string = ''
  let manifest: Manifest

	return <PluginOption>{
		name: "vite-plugin-happy-crx",
		enforce: "pre",
		//apply(_, { command }) {
    //  if (command === 'serve' && dev)
    //    return true
    //  if (command === 'build' && build)
    //    return true
    //  return false
    //},
		configResolved(config) {
			root = normalizePath(config.root);
			outDir = join(root, config.build.outDir);
      //nodeModulesRoot = join(root, NODE_MODULES)
      //nodeModulesShadow = join(outDir, NODE_MODULES)
      //virtualDir = join(outDir, VIRTUAL_DIR)
      urlMaps.set(options, new Map())
      manifest = new Manifest(root, outDir)
		},

		async configureServer(server) {
      await rm(outDir)
      await createDir(outDir)
      // await createDir(virtualDir)

      // link node_modules
      //await symlink(nodeModulesRoot, nodeModulesShadow)

      await lexerInit

      server.httpServer?.on('listening', async () => {
        const urlMap = urlMaps.get(options)!
        // get module info from server
        async function getModuleInfo(url: string) {
          const res = await  server.transformRequest(url)
          if(!res) {
            return
          }

          const {code, map}= res
          const moduleNode = await server.moduleGraph.getModuleByUrl(url)
          if(!moduleNode?.id) {
            return
          }

          const deps: string[] = Array.from(moduleNode.importedModules ?? [])
            .filter(m => !!m.id)
            .map(m => fileToUrl(m.id!, root))

         
          return {id: moduleNode.id, deps, code, map} 
        }
      
        // transform imported urls to crx relative path in code
        async function importedUrlToPath(importer: string, code: string, map: Rollup.SourceMap | null) {
          const [imports] = parseESM(code)
          const str = new MagicString(code)

          await Promise.all(
            imports.map(async ({n,s,e}) => {
              const url = n ?? code.slice(s, e)
              let target = urlMap.get(url)?.target
              try {
                if(!target) {
                  const moduleInfo = await getModuleInfo(url)
                  target = await idToTarget(moduleInfo!.id!, root)
                }
                target = relativePath(importer, target)
                str.update(s, e, target)
                
              } catch(err) {}
            })
          )

          if(map?.toString) {
            str.replace(/\/\/#\s*sourceMappingURL.+\s*/, '')
            str.append(`\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(map.toString(), 'utf8').toString('base64')}`)
          }

          return str.toString()
        }

        const urlQueue = [VITE_CLIENT, ...manifest.getEntries()]

        // query and emit all modules to outDir
        while(urlQueue.length)  {
          const url = urlQueue.shift()
          const moduleInfo = await getModuleInfo(url!)

          if(!moduleInfo){
            continue
          }

          const moduleFile = urlMap.get(url!) ?? {
            id: moduleInfo.id,
            target: await idToTarget(moduleInfo.id, root)
          }

          urlMap.set(url!, moduleFile)
          urlQueue.push(...moduleInfo.deps)

          emitFile(
            join(outDir, moduleFile.target),
            // @ts-expect-error map's type is compatible
            await importedUrlToPath(moduleFile.target, moduleInfo.code, moduleInfo.map)
          )
        }

        // emit manifest to outDir
        manifest.create(urlMap)

        // emit content loaders
        manifest.getContentTargets(urlMap).map(target => {
          return new ContentLoader(outDir, target).emit()
        })
      })
    }
  }
}
