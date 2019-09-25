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
} from './packets'

async function main() {
  const ticket = await getTicket('http://127.0.0.1:1984', 'default', 'codehz')
  start('ws://127.0.0.1:2480', ticket)
}

async function getTicket(
  endpoint: string,
  serverid: string,
  username: string,
): Promise<ArrayBuffer> {
  const req = await fetch(`${endpoint}/login/${serverid}/${username}`, {
    mode: 'cors',
  })
  return req.arrayBuffer()
}

enum Stage {
  Closed = -1,
  Initial = 0,
  Running = 1,
}

let conn: WebSocket
let stage: Stage = Stage.Closed

function start(address: string, ticket: ArrayBuffer) {
  conn = new WebSocket(address)
  conn.binaryType = 'arraybuffer'
  conn.addEventListener('open', () => further(ticket))
  conn.addEventListener('message', ev => handle(ev.data as ArrayBuffer))
  conn.addEventListener('close', () => (stage = Stage.Closed))
}

function further(ticket: ArrayBuffer) {
  conn.send(ticket)
  stage = Stage.Initial

  const input = document.createElement('input')
  document.body.append(input)
  input.addEventListener('keyup', ev => {
    if (ev.keyCode == 13) {
      const pkt = createChatPacket(input.value)
      input.value = ''
      conn.send(pkt)
    }
  })
}

function handle(buffer: ArrayBuffer) {
  const i = new io.Input(new DataView(buffer))
  for (const pkt of emitPackets(parsePacket(i))) {
    console.log('Received packet %o', pkt)
    switch (stage) {
      case Stage.Initial:
        if (pkt instanceof GameStartPacket) {
          stage = Stage.Running
        } else if (pkt instanceof DisconnectPacket) {
          console.warn('Disconnected ', pkt.message)
          stage = Stage.Closed
        } else {
          console.error('Unexcepted packet %o', pkt)
        }
        break
      case Stage.Running:
        if (pkt instanceof TextPacket) {
          if (pkt.payload instanceof TextPacketPlainTextPayload) {
            console.log(pkt.sender + ':' + pkt.payload.content)
          }
        } else if (pkt instanceof DisconnectPacket) {
          console.warn('Disconnected %o', pkt.message)
          stage = Stage.Closed
        }
        break
      default:
        console.error('Unimplemented stage %d', stage)
    }
  }
}

function createChatPacket(text: string): ArrayBuffer {
  const out = new io.Output()
  const pkt = new ChatPacket()
  pkt.message = text
  buildPacket(out, pkt)
  return out.write()
}

main()
