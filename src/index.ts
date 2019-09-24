import * as io from 'packedio'
import { ChatPacket, buildPacket, parsePacket, TextPacket, TextPacketPlainTextPayload, DisconnectPacket } from './packets';

async function main() {
  const ticket = await getTicket("http://127.0.0.1:1984", "default", "codehz")
  start("ws://127.0.0.1:2480", ticket)
}

async function getTicket(endpoint: string, serverid: string, username: string): Promise<ArrayBuffer> {
  const req = await fetch(`${endpoint}/login/${serverid}/${username}`, { mode: 'cors' });
  return req.arrayBuffer()
}

var conn: WebSocket

function start(address: string, ticket: ArrayBuffer) {
  conn = new WebSocket(address)
  conn.binaryType = "arraybuffer"
  conn.addEventListener("open", () => further(ticket))
  conn.addEventListener("message", ev => handle(ev.data as ArrayBuffer))
}

function further(ticket: ArrayBuffer) {
  conn.send(ticket)

  const input = document.createElement("input")
  document.body.append(input)
  input.addEventListener("keyup", ev => {
    if (ev.keyCode == 13) {
      const pkt = createChatPacket(input.value)
      input.value = ""
      conn.send(pkt)
    }
  })
}

function handle(buffer: ArrayBuffer) {
  const i = new io.Input(new DataView(buffer))
  const pkt = parsePacket(i)
  console.log(pkt)
  if (pkt instanceof TextPacket) {
    if (pkt.payload instanceof TextPacketPlainTextPayload) {
      console.log(pkt.sender + ":" + pkt.payload.content)
    }
  } else if (pkt instanceof DisconnectPacket) {
    console.warn(pkt.message)
  }
}

function createChatPacket(text: string): ArrayBuffer {
  const out = new io.Output()
  const pkt = new ChatPacket
  pkt.message = text
  buildPacket(out, pkt)
  return out.write()
}

main()