import * as io from 'packedio'

enum PacketId {
  Login = 0x01,
  Disconnect = 0x02,
  ChunkData = 0x03,
  Chat = 0x04,
  Text = 0x05,
  GameStart = 0x06
}

const id: unique symbol = Symbol("id")

export interface Packet extends io.Serializable {
  readonly [id]: PacketId
}

export function parsePacket(i: io.Input): Packet {
  const id = i.readUint8()
  let ret: Packet
  switch (id) {
    case PacketId.Login:
      ret = new LoginPacket
      break
    case PacketId.Disconnect:
      ret = new DisconnectPacket
      break
    case PacketId.ChunkData:
      ret = new ChunkDataPacket
      break
    case PacketId.Chat:
      ret = new ChatPacket
      break
    case PacketId.Text:
      ret = new TextPacket
      break
    case PacketId.GameStart:
      ret = new GameStartPacket
      break
    default:
      throw new Error("Failed to parse packet: unknown packet")
  }
  ret.Load(i)
  return ret
}

export function buildPacket(o: io.Output, pkt: Packet) {
  o.pushUint8(pkt[id])
  pkt.Save(o)
}

export class LoginPacket implements Packet {
  readonly [id] = PacketId.Login
  Load(i: io.Input): void {
    throw new Error("Method not implemented.")
  }
  Save(o: io.Output): void {
    throw new Error("Method not implemented.")
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

export class ChunkDataPacket implements Packet {
  readonly [id] = PacketId.ChunkData
  Load(i: io.Input): void {
    throw new Error("Method not implemented.")
  }
  Save(o: io.Output): void {
    throw new Error("Method not implemented.")
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
  PlainText = 0
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
    case TextPacketPayloadType.PlainText: return new TextPacketPlainTextPayload
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
      throw new Error("Failed to parse text packet payload: unknown payload type")
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

export class GameStartPacket implements Packet {
  [id] = PacketId.GameStart
  username: string
  label: string
  motd: string
  Load(i: io.Input): void {
    this.username = i.readString()
    this.label = i.readString()
    this.motd = i.readString()
  }
  Save(o: io.Output): void {
    o.pushString(this.username)
    o.pushString(this.label)
    o.pushString(this.motd)
  }
}