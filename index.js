import { oscReceiverSetup } from "./receiver.js"
import Broadcaster from "./broadcasterClass.js"

const oscReceiverPort = 57121

const broadcaster = new Broadcaster({ oscReceiverPort })

oscReceiverSetup({ 
    messageHandler: (msg) => { broadcaster.saveMessage(msg) },
    oscReceiverPort,
})