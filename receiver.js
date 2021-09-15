import osc from "osc"

// config for local UDP ports
const localAddress = '0.0.0.0'
const openVibeReceiverPort = 57121

export const oscReceiverSetup = ({ messageHandler }) => {
    const udpPort = new osc.UDPPort({ localAddress, localPort: openVibeReceiverPort })

    const readyHandler = () => { console.log(`Listening for OSC over UDP port ${udpPort.options.localPort}`) }
    const errHandler = (err) => { console.error(err) }
    
    udpPort.on("ready", readyHandler)
    udpPort.on("message", messageHandler)
    udpPort.on("error", errHandler)
    
    udpPort.open()
}
