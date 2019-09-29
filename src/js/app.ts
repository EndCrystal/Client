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
} from './packets'

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

  private handle(buffer: ArrayBuffer) {
    const i = new io.Input(new DataView(buffer))
    for (const pkt of emitPackets(parsePacket(i))) {
      this.effects.log('Received packet %o', pkt)
      switch (this.stage) {
        case Stage.Initial:
          if (pkt instanceof GameStartPacket) {
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
            this.effects.log("Chunk data received: %o", pkt)
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
