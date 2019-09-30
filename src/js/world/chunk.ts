import { BlockInstance, Block } from './block'

export interface SubChunk {
  GetBlock(pos: number): BlockInstance
  SetBlock(pos: number, blk: BlockInstance): SubChunk | void
}

const air = new BlockInstance()
air.block = new Block('core:air', 0)

export class NormalSubChunk implements SubChunk {
  blocks: BlockInstance[] = new Array(4096).fill(air)
  GetBlock(pos: number): BlockInstance {
    return this.blocks[pos]
  }
  SetBlock(pos: number, blk: BlockInstance): SubChunk | void {
    this.blocks[pos] = blk
  }
}

export class EmptySubChunk implements SubChunk {
  GetBlock(pos: number): BlockInstance {
    return air
  }
  SetBlock(pos: number, blk: BlockInstance): SubChunk | void {
    if (blk.block.name == 'core:air') return
    const ret = new NormalSubChunk()
    ret.SetBlock(pos, blk)
    return ret
  }
}

export class Chunk {
  subs: SubChunk[] = Array.from({ length: 16 }, () => new EmptySubChunk())
  bgsubs: SubChunk[] = Array.from({ length: 16 }, () => new EmptySubChunk())
}
