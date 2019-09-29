import * as io from 'packedio'
import { inflate } from 'pako'

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

export function parsePacket(i: io.Input): Packet {
  const id = i.readUint8()
  let ret: Packet
  switch (id) {
    case PacketId.Batch:
      ret = new BatchPacket()
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
      ret = new ChunkDataPacket()
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
  Load(i: io.Input): void {
    this.packets = []
    i.iterateArray(() => this.packets.push(parsePacket(i)))
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
  pos: [number, number]
  blocks: { [key: string]: number }
  components: string[]
  Load(i: io.Input): void {
    this.username = i.readString()
    this.label = i.readString()
    this.motd = i.readString()
    this.pos = [i.readInt32(), i.readInt32()]
    this.blocks = {}
    i.iterateObject(key => (this.blocks[key] = i.readUint8()))
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
  data: Uint8Array
  Load(i: io.Input): void {
    this.pos = [i.readInt32(), i.readInt32()]
    this.data = inflate(new Uint8Array(i.readBytes()))
  }
  Save(o: io.Output): void {
    throw new Error('Method not implemented.')
  }
}
