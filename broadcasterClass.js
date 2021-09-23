import WebSocket, { WebSocketServer } from 'ws'
import readline from 'readline'
import osc from 'osc'
import fs from 'fs'

const defaults = {
    localAddress: '0.0.0.0',
    websocketBroadcastPort: 8080,
    udpBroadcastPort: 57122,
    oscDestinationAddress: '0.0.0.0',
    oscDestinationPort: '9001',
    broadcastIntervalInMs: 100,
}

export default class Broadcaster {
    constructor({
        localAddress = defaults.localAddress,
        websocketBroadcastPort = defaults.websocketBroadcastPort,
        udpBroadcastPort = defaults.udpBroadcastPort,
        oscDestinationAddress = defaults.oscDestinationAddress,
        oscDestinationPort = defaults.oscDestinationPort,
        broadcastIntervalInMs = defaults.broadcastIntervalInMs,
    } = defaults) {
        this.localAddress = localAddress
        this.websocketBroadcastPort = websocketBroadcastPort
        this.udpBroadcastPort = udpBroadcastPort
        this.oscDestinationAddress = oscDestinationAddress
        this.oscDestinationPort = oscDestinationPort

        this.broadcastIntervalInMs = broadcastIntervalInMs
        
        this.udpPort = null
        this.udpReady = false
        this.udpLastErrorTimestamp = null

        this.wss = null
        this.websocketReady = false

        this.savedMessages = {}
        this.msgCounts = {}

        this.broadcaster = null

        this.recordingInProgress = false
        this.playbackInProgress = false

        this.init()
    }

    init() {
        console.log('Setting up UDP and WSS Servers for Broadcast')
        this.initUDP()
        this.initWSS()

        const interval = 10
        let timeWaiting = 0
        let waiting = setInterval(() => {
            const printProgress = () => {
                readline.clearLine(process.stdout)
                readline.cursorTo(process.stdout, 0)
                process.stdout.write(`udpReady: ${this.udpReady} | websocketReady: ${this.websocketReady} | timeWaiting < ${timeWaiting = timeWaiting + interval}ms`)
            }
            if (!this.udpReady || !this.websocketReady) {
                printProgress()
            } else {
                printProgress()
                process.stdout.write('\n')
                clearInterval(waiting)
                console.log('When OSC received on 57121, will re-broadcast data...')
                console.log(`...via OSC to ${this.oscDestinationAddress}:${this.oscDestinationPort} via local UDP port ${this.udpBroadcastPort}`)
                console.log(`...via Websockets to connected clients over port ${this.websocketBroadcastPort}`)
                this.setUpBroadcastAtInterval()
            }
        }, interval)
    }

    initUDP() {
        this.udpPort = new osc.UDPPort({
            localAddress: this.localAddress,
            localPort: this.udpBroadcastPort
        })

        this.udpPort.open()
        this.udpPort.on("error", (err) => {
            this.udpLastErrorTimestamp = new Date().getTime()
            console.log(`UDP Error @ ${this.udpLastErrorTimestamp} :: ${err.message}`)
        })
        this.udpPort.on('ready', () => { this.udpReady = true })
    }

    fetchRecordingsData() {
        return {
            type: 'recordingsData',
            recordings: fs.readdirSync('./recordings') || []
        }
    }

    playRecording(recording) {
        this.playbackInProgress = true

        try {
            const rawRecording = fs.readFileSync(`./recordings/${recording}`)
            const recordingData = JSON.parse(rawRecording)
            recordingData.forEach((messageSet, i) => {
                setTimeout(() => {
                    Object.entries(messageSet).forEach(([address, args]) => { 
                        this.saveMessage({ address, args }, true)
                    })
                    const isLastMessage = recordingData.length === i + 1
                    if (isLastMessage) setTimeout(() => { this.playbackInProgress = false }, this.broadcastIntervalInMs)
                }, this.broadcastIntervalInMs * i);
            })

        } catch(err) {
            console.log('recording playback error:', err)
            this.playbackInProgress = false
            return
        }
    }
    
    initWSS() {
        this.wss = new WebSocketServer({ port: this.websocketBroadcastPort })
        this.wss.on('connection', (ws) => {
            ws.on('message', (msg) => {
                const parsedMessage = JSON.parse(msg)
                switch (parsedMessage.type) {
                    case 'loadRecordings':
                        ws.send(JSON.stringify(this.fetchRecordingsData()))
                        break;
                    case 'playRecording':
                        this.playRecording(parsedMessage.recording)
                        break;
                    default:
                        console.log('received unknown msg: %s', msg)
                }
            })
        })
        this.websocketReady = true
    }

    broadcastSavedMessages() {
        if (!this.udpReady) throw new Error('UDP not ready')
        if (!this.websocketReady) throw new Error('Websocket not ready')
        
        const msgs = this.savedMessages
        if (Object.keys(msgs).length) {
            this.broadcastOverWebsocket(msgs)
            this.broadcastOverUDP(msgs)
        }
        this.clearMessages(msgs)
    }

    broadcastOverWebsocket(msgs) {
        const stringifiedMsgObjects = JSON.stringify(msgs, null, 2)
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(stringifiedMsgObjects)
            }
        })
    }

    broadcastOverUDP(msgs) {
        for (var key in msgs) {
            this.udpPort.send({
                address: key,
                args: msgs[key]
            }, this.oscDestinationAddress, this.oscDestinationPort)
        }
    }

    setUpBroadcastAtInterval() {
        this.broadcaster = setInterval(() => this.broadcastSavedMessages(), this.broadcastIntervalInMs)
    }

    saveMessage({ address, args }, isFromRecording = false) {
        // forget about any data that arrives while playing back a recording (unless the data is from the recording!)
        if (this.playbackInProgress && !isFromRecording) return

        // increment or start message counter for given address
        if (this.savedMessages[address]) {
            this.msgCounts[address] = this.msgCounts[address] + 1 
        } else { 
            this.msgCounts[address] = 1 
        }
    
        // save the message
        this.savedMessages[address] = args
    }

    clearMessages(msgs) {
        for (var key in msgs) if (msgs.hasOwnProperty(key)) delete msgs[key]
    }

    stopBroadcast() {
        if (this.broadcaster) {
            clearInterval(this.broadcaster)
            this.broadcaster = null
        }
    }

} 
