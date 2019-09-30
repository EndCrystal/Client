import * as io from 'packedio'
import { inflate } from 'pako'
import { attribute, Block, BlockInstance } from './world/block'
import { Chunk } from './world/chunk'

enum PacketId {
  Batch,
  Login,
  Disconnect,
  GameStart,
  Chat,
  Text,
  ChunkRequest,
  ChunkData,
}

const id: unique symbol = Symbol('id')

export interface Packet extends io.Serializable {
  readonly [id]: PacketId
}

export function* emitPackets(pkt: Packet): IterableIterator<Packet> {
  if (pkt instanceof BatchPacket) {
    for (const item of pkt.packets) {
      yield* emitPackets(item)
    }
  } else {
    yield pkt
  }
}

export interface ParseContext {
  GetBlockByName(name: string): Block
}

export function parsePacket(i: io.Input, ctx: ParseContext): Packet {
  const id = i.readUint8()
  let ret: Packet
  switch (id) {
    case PacketId.Batch:
      ret = new BatchPacket(ctx)
      break
    case PacketId.Login:
      ret = new LoginPacket()
      break
    case PacketId.Disconnect:
      ret = new DisconnectPacket()
      break
    case PacketId.GameStart:
      ret = new GameStartPacket()
      break
    case PacketId.Chat:
      ret = new ChatPacket()
      break
    case PacketId.Text:
      ret = new TextPacket()
      break
    case PacketId.ChunkData:
      ret = new ChunkDataPacket(ctx)
      break
    default:
      throw new Error('Failed to parse packet: unknown packet')
  }
  ret.Load(i)
  return ret
}

export function buildPacket(o: io.Output, pkt: Packet) {
  o.pushUint8(pkt[id])
  pkt.Save(o)
}

export class BatchPacket implements Packet {
  [id] = PacketId.Batch
  packets: Packet[]
  ctx: ParseContext
  constructor(ctx: ParseContext) {
    this.ctx = ctx
  }
  Load(i: io.Input): void {
    this.packets = []
    i.iterateArray(() => this.packets.push(parsePacket(i, this.ctx)))
  }
  Save(o: io.Output): void {
    o.pushArray(this.packets, item => buildPacket(o, item))
  }
}

export class LoginPacket implements Packet {
  readonly [id] = PacketId.Login
  Load(i: io.Input): void {
    throw new Error('Method not implemented.')
  }
  Save(o: io.Output): void {
    throw new Error('Method not implemented.')
  }
}

export class DisconnectPacket implements Packet {
  readonly [id] = PacketId.Disconnect
  message: string
  Load(i: io.Input): void {
    this.message = i.readString()
  }
  Save(o: io.Output): void {
    o.pushString(this.message)
  }
}

export class GameStartPacket implements Packet {
  [id] = PacketId.GameStart
  username: string
  label: string
  motd: string
  maxViewDistance: number
  pos: [number, number]
  blocks: [string, attribute][]
  components: string[]
  Load(i: io.Input): void {
    this.username = i.readString()
    this.label = i.readString()
    this.motd = i.readString()
    this.maxViewDistance = i.readVarUint32()
    this.pos = [i.readInt32(), i.readInt32()]
    this.blocks = []
    i.iterateObject(key => this.blocks.push([key, i.readUint8()]))
    this.components = []
    i.iterateArray(() => {
      this.components.push(i.readString())
    })
  }
  Save(o: io.Output): void {
    throw new Error('Method not implemented.')
  }
}

export class ChatPacket implements Packet {
  readonly [id] = PacketId.Chat
  message: string
  Load(i: io.Input): void {
    this.message = i.readString()
  }
  Save(o: io.Output): void {
    o.pushString(this.message)
  }
}

export enum TextPacketFlags {
  Normal = 0x0,
  FromSystem = 0x1,
  ShowSender = 0x2,
}

export enum TextPacketPayloadType {
  PlainText = 0,
}

export interface TextPacketPayload extends io.Serializable {
  type: TextPacketPayloadType
}

export class TextPacketPlainTextPayload implements TextPacketPayload {
  type = TextPacketPayloadType.PlainText
  content: string
  Load(i: io.Input): void {
    this.content = i.readString()
  }
  Save(o: io.Output): void {
    o.pushString(this.content)
  }
}

function GetTextPacketPayload(type: TextPacketPayloadType): TextPacketPayload {
  switch (type) {
    case TextPacketPayloadType.PlainText:
      return new TextPacketPlainTextPayload()
  }
  return null
}

export class TextPacket implements Packet {
  readonly [id] = PacketId.Text
  flags: TextPacketFlags
  sender: string
  payload: TextPacketPayload
  Load(i: io.Input): void {
    this.flags = i.readUint8()
    this.sender = i.readString()
    this.payload = GetTextPacketPayload(i.readUint8())
    if (this.payload == null) {
      throw new Error('Failed to parse text packet payload: unknown payload type')
    }
    this.payload.Load(i)
  }
  Save(o: io.Output): void {
    o.pushUint8(this.flags)
    o.pushString(this.sender)
    o.pushUint8(this.payload.type)
    this.payload.Save(o)
  }
}

export class ChunkRequestPacket implements Packet {
  readonly [id] = PacketId.ChunkRequest
  pos: [number, number]
  constructor(pos?: [number, number]) {
    this.pos = pos
  }
  Load(i: io.Input): void {
    throw new Error('Method not implemented.')
  }
  Save(o: io.Output): void {
    o.pushInt32(this.pos[0])
    o.pushInt32(this.pos[1])
  }
}

export class ChunkDataPacket implements Packet {
  readonly [id] = PacketId.ChunkData
  pos: [number, number]
  // data: Uint8Array
  chunk: Chunk
  private ctx: ParseContext
  constructor(ctx: ParseContext) {
    this.ctx = ctx
  }
  Load(i: io.Input): void {
    this.pos = [i.readInt32(), i.readInt32()]
    const data: Uint8Array = inflate(new Uint8Array(i.readBytes()))
    const ni = new io.Input(new DataView(data.buffer))
    this.chunk = new Chunk()

    // read local block map
    let airmark = -1
    const lobmap = ni.readArray(idx => {
      const name = ni.readString()
      const blk = this.ctx.GetBlockByName(name)
      if (blk == null) {
        throw new Error(`Failed to load block ${name}`)
      }
      if (name == 'core:air') airmark = idx
      const bi = new BlockInstance()
      bi.block = blk
      if (blk.hasAux()) {
        bi.aux = ni.readUint32()
      }
      if (blk.hasColor()) {
        bi.aux = ni.readUint32()
      }
      return bi
    })

    for (let idx = 0; idx < 65536; idx++) {
      const x = ni.readVarUint32()
      if (x == airmark) continue
      const bi = lobmap[x]
      if (!bi) {
        throw new Error(`Unknown block instance ${x}`)
      }
      const nw = this.chunk.subs[(idx / 4096) | 0].SetBlock(idx % 4096, bi)
      if (nw) this.chunk.subs[(idx / 4096) | 0] = nw
    }
    for (let idx = 0; idx < 65536; idx++) {
      const x = ni.readVarUint32()
      if (x == airmark) continue
      const bi = lobmap[x]
      if (!bi) {
        throw new Error(`Unknown block instance ${x}`)
      }
      const nw = this.chunk.bgsubs[(idx / 4096) | 0].SetBlock(idx % 4096, bi)
      if (nw) this.chunk.bgsubs[(idx / 4096) | 0] = nw
    }
  }
  Save(o: io.Output): void {
    throw new Error('Method not implemented.')
  }
}
