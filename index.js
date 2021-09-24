import { oscReceiverSetup } from './receiver.js'
import Broadcaster from './broadcasterClass.js'

const oscReceiverPort = 57121
const adminPagePort = 8002

const broadcaster = new Broadcaster({ oscReceiverPort })

oscReceiverSetup({ 
    messageHandler: (msg) => { broadcaster.saveMessage(msg) },
    oscReceiverPort,
})

if (process.env.ADMIN_PAGE) {
    import('./simpleHttpServer.js').then(({ serve }) => { serve('./web', adminPagePort) })
}
