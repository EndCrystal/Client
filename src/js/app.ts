import * as io from 'packedio'
import {
  ChatPacket,
  buildPacket,
  parsePacket,
  TextPacket,
  TextPacketPlainTextPayload,
  DisconnectPacket,
  GameStartPacket,
  emitPackets,
  ChunkRequestPacket,
  ChunkDataPacket,
  BatchPacket,
  ParseContext,
} from './packets'
import { BlockRegistry, Block } from './world/block'

export interface ApplicationEffects {
  log(msg: string, ...obj: any[]): void
  warn(msg: string, ...obj: any[]): void
  error(msg: string, ...obj: any[]): void
  onClosed(): void
  onInitial(): void
  onStarting(): void
}

export class Application {
  private conn: WebSocket
  private stage: Stage = Stage.Closed
  private effects: ApplicationEffects
  private blocks = new BlockRegistry()

  constructor(address: string, ticket: ArrayBuffer, effects: ApplicationEffects) {
    this.effects = effects
    this.conn = new WebSocket(address)
    this.conn.binaryType = 'arraybuffer'
    this.conn.addEventListener('open', () => this.run(ticket))
    this.conn.addEventListener('message', ev => this.handle(ev.data as ArrayBuffer))
    this.conn.addEventListener('close', () => (this.stage = Stage.Closed))
  }

  private changeStage(newStage: Stage) {
    this.stage = newStage
    switch (newStage) {
      case Stage.Closed:
        this.effects.onClosed()
        break
      case Stage.Initial:
        this.effects.onInitial()
        break
      case Stage.Starting:
        this.effects.onStarting()
        break
    }
  }

  private run(ticket: ArrayBuffer) {
    this.conn.send(ticket)
    this.changeStage(Stage.Initial)
  }

  private ifce: ParseContext = {
    GetBlockByName: (name: string): Block => this.blocks.getByName(name),
  }

  private handle(buffer: ArrayBuffer) {
    const i = new io.Input(new DataView(buffer))
    for (const pkt of emitPackets(parsePacket(i, this.ifce))) {
      this.effects.log('Received packet %o', pkt.constructor.name)
      switch (this.stage) {
        case Stage.Initial:
          if (pkt instanceof GameStartPacket) {
            pkt.blocks.forEach(([k, v]) => this.blocks.register(k, v))
            this.changeStage(Stage.Starting)
          } else if (pkt instanceof DisconnectPacket) {
            this.effects.warn('Disconnected ', pkt.message)
            this.changeStage(Stage.Closed)
          } else {
            this.effects.error('Unexcepted packet %o in stage initial', pkt)
          }
          break
        case Stage.Starting:
          if (pkt instanceof TextPacket) {
            if (pkt.payload instanceof TextPacketPlainTextPayload) {
              this.effects.log(pkt.sender + ':' + pkt.payload.content)
            }
          } else if (pkt instanceof DisconnectPacket) {
            this.effects.warn('Disconnected %o', pkt.message)
            this.changeStage(Stage.Closed)
          } else if (pkt instanceof ChunkDataPacket) {
            this.effects.log('Chunk data received: %o', pkt.chunk)
          } else {
            this.effects.error('Unexcepted packet %o in stage running', pkt)
          }
          break
        default:
          this.effects.error('Unimplemented stage %d', this.stage)
      }
    }
  }

  sendChatMessage(text: string) {
    const pkt = createChatPacket(text)
    this.conn.send(pkt)
  }

  sendChunkRequest(pos: [number, number]) {
    const pkt = createChunkRequestPacket(pos)
    this.conn.send(pkt)
  }

  sendChunkRequests(start: [number, number], end: [number, number]) {
    const batch = new BatchPacket(this.ifce)
    let c = 0
    batch.packets = new Array((end[0] - start[0]) * (end[1] - start[1]))
    for (let i = start[0]; i <= end[0]; i++) {
      for (let j = start[1]; j <= end[1]; j++) {
        batch.packets[c] = new ChunkRequestPacket([i, j])
        c++
      }
    }
    const out = new io.Output()
    buildPacket(out, batch)
    this.conn.send(out.write())
  }
}

enum Stage {
  Closed = -1,
  Initial = 0,
  Starting = 1,
}

function createChatPacket(text: string): ArrayBuffer {
  const out = new io.Output()
  const pkt = new ChatPacket()
  pkt.message = text
  buildPacket(out, pkt)
  return out.write()
}
function createChunkRequestPacket(pos: [number, number]): ArrayBuffer {
  const out = new io.Output()
  const pkt = new ChunkRequestPacket()
  pkt.pos = pos
  buildPacket(out, pkt)
  return out.write()
}
