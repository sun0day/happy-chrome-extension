import {access,constants,mkdir, rm as nativeRm, readlink, writeFile}from 'node:fs/promises'
import {dirname, isAbsolute, join, normalize, relative, resolve, sep} from 'node:path'
import {ModuleFile} from './types'

export const VITE_CLIENT = '/@vite/client'
export const VITE_FS = '/@fs'
export const NODE_MODULES = 'node_modules'
export const VIRTUAL_DIR = 'virtual'
export const EXTERNAL_DIR = 'external'
export const DOT = '.'
export const SLASH = '/'
export const CUR_DIR = './'
export const PARENT_DIR = '../'
export const JS_EXT = '.js'
export const EXT_REG = /(\.[^\/\?\.]+)($|\?.+)/

export const getAbsolutePath = (path: string, root?: string) => {
  return (isAbsolute(path) ? path : resolve(root ?? '', path)).replace(/\?.+$/, '')
}

// detect whether a file or dir exists
export const exist = async (file: string, root?: string) => {
	return (await access(
    getAbsolutePath(file, root), constants.F_OK
  ).catch(() => false)) ?? true
}

// create dir if it does not exist
export const createDir = async (dir: string, root?: string) => {
	if(!(await exist(dir, root))) {
    return mkdir(getAbsolutePath(dir, root), {recursive: true})    
	} 
}

// rm dir or file if it exist
export const rm = async (dir: string, root?: string) => {
  if(await exist(dir, root)){
    return nativeRm(getAbsolutePath(dir, root), {recursive: true})
  }
}

// redirect file path
export const redirectFile = (source: string, root: string, target: string) => {
  const relativePath = relative(root, source)

  return resolve(target, relativePath)
}

// emit file from source
export const emitFile = async (target: string, content: string) => {
  const targetDir = dirname(target)
  
  if(!(await exist(targetDir)))  {
    await createDir(targetDir)
  }

  await writeFile(target, content)
}

// file path to url
export const fileToUrl = (id: string, root: string) => {
  return id.startsWith(root + SLASH) ? id.slice(root.length) : id
}

// abs file to output target
export const idToTarget = async (id: string, root: string) => {
  let target = ''
  // /root/xxx
  if(id.startsWith(root + SLASH)) {
    target =  `${DOT}${id.slice(root.length)}` 
  } else if(await exist(id)) {
  // external
    target =  `${CUR_DIR}${EXTERNAL_DIR}${SLASH}${id.split(SLASH).slice(-4).join(SLASH)}` 
  } else {
  // virtual files
    target = `${CUR_DIR}${VIRTUAL_DIR}${id}`
  }

  target = target.replace(EXT_REG, (_, ext) => ext)
  
  return target.endsWith(JS_EXT) ? target : `${target}${JS_EXT}`
}

export const relativePath = (importer: string, importId: string) => {
  const rp = relative(importer, importId).replace(PARENT_DIR, CUR_DIR)
  return rp.startsWith(`${CUR_DIR}${PARENT_DIR}`) ? rp.replace(CUR_DIR, '') : rp
}

                          
