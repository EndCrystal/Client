import { Application } from './app'

async function main() {
  const ticket = await getTicket('http://127.0.0.1:1984', 'default', 'codehz')
  const app = new Application('ws://127.0.0.1:2480', ticket, {
    log(msg: string, ...obj: any[]): void {
      console.log(msg, ...obj)
    },
    warn(msg: string, ...obj: any[]): void {
      console.warn(msg, ...obj)
    },
    error(msg: string, ...obj: any[]): void {
      console.error(msg, ...obj)
    },
    onClosed(): void {
      console.log('closed')
    },
    onInitial(): void {
      console.log('initial')
    },
    onStarting(): void {
      console.log('starting')
      const input = document.createElement('input')
      document.body.append(input)
      input.addEventListener('keyup', ev => {
        if (ev.keyCode == 13) {
          app.sendChatMessage(input.value)
          input.value = ''
        }
      })

      const btn = document.createElement('button')
      btn.textContent = 'test chunk request'
      document.body.append(btn)
      btn.addEventListener('click', ev => {
        ev.preventDefault()
        app.sendChunkRequests([-8, -8], [8, 8])
        // for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) app.sendChunkRequest([i, j])
      })
    },
  })
}

async function getTicket(endpoint: string, serverid: string, username: string): Promise<ArrayBuffer> {
  const req = await fetch(`${endpoint}/login/${serverid}/${username}`, {
    mode: 'cors',
  })
  return req.arrayBuffer()
}

main()
