import { createHash } from 'crypto'

export function sha256(data: Buffer | string): string {
  const hash = createHash('sha256')
  
  if (Buffer.isBuffer(data)) {
    hash.update(data)
  } else {
    hash.update(data, 'utf8')
  }
  
  return hash.digest('hex')
}