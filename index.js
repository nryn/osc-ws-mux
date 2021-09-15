import { oscReceiverSetup } from "./receiver.js"
import Broadcaster from "./broadcasterClass.js"

const broadcaster = new Broadcaster({
    oscDestinationAddress: '172.20.10.6', // e.g. an IP Address on a local network
    oscDestinationPort: '9001', // e.g. a port on the above address that wants to receive OSC messages
})

oscReceiverSetup({ 
    messageHandler: (msg) => { broadcaster.saveMessage(msg) } 
})