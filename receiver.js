import osc from "osc"

export const oscReceiverSetup = ({ messageHandler, oscReceiverAddress, oscReceiverPort }) => {
    const udpPort = new osc.UDPPort({ 
        localAddress: oscReceiverAddress || '0.0.0.0',
        localPort: oscReceiverPort || 57121 
    })

    const readyHandler = () => { console.log(`Listening for OSC over UDP port ${udpPort.options.localPort}`) }
    const errHandler = (err) => { console.error(err) }
    
    udpPort.on("ready", readyHandler)
    udpPort.on("message", messageHandler)
    udpPort.on("error", errHandler)
    
    udpPort.open()
}
