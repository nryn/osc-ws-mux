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
    oscReceiverPort: 57121,
    broadcastIntervalInMs: 100,
}

export default class Broadcaster {
    constructor({
        localAddress = defaults.localAddress,
        websocketBroadcastPort = defaults.websocketBroadcastPort,
        udpBroadcastPort = defaults.udpBroadcastPort,
        oscDestinationAddress = defaults.oscDestinationAddress,
        oscDestinationPort = defaults.oscDestinationPort,
        oscReceiverPort = defaults.oscReceiverPort,
        broadcastIntervalInMs = defaults.broadcastIntervalInMs,
    } = defaults) {
        this.localAddress = localAddress
        this.websocketBroadcastPort = websocketBroadcastPort
        this.oscReceiverPort = oscReceiverPort

        this.udpBroadcastPort = udpBroadcastPort
        this.oscDestinationAddress = oscDestinationAddress
        this.oscDestinationPort = oscDestinationPort

        this.broadcastIntervalInMs = broadcastIntervalInMs
        
        this.oscRelayEnabled = false
        this.udpPort = null
        this.udpReady = false
        this.udpLastErrorTimestamp = null

        this.wss = null
        this.websocketReady = false

        this.savedMessages = {}
        this.msgCounts = {}

        this.broadcaster = null

        this.recordingInProgress = false
        this.currentRecordingFilename = 'default.json'
        this.currentRecordingData = []
        this.playbackInProgress = false
        this.nowPlaying = {}

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
                console.log('When OSC received, will re-broadcast data...')
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
    
    initWSS() {
        this.wss = new WebSocketServer({ port: this.websocketBroadcastPort })
        this.wss.on('connection', (ws) => {
            ws.on('message', (msg) => {
                const parsedMessage = JSON.parse(msg)
                switch (parsedMessage.type) {
                    case 'loadRecordings':
                        ws.send(JSON.stringify(this.fetchRecordingsData()))
                        break;
                    case 'recordingStatus':
                        ws.send(JSON.stringify(this.currentRecordingStatus()))
                        break;
                    case 'ioConfig':
                        ws.send(JSON.stringify(this.currentIoConfig()))
                        break;
                    case 'playingStatus':
                        ws.send(JSON.stringify(this.currentPlayingStatus()))
                        break;
                    case 'playRecording':
                        this.playRecording(parsedMessage.recording)
                        this.broadcastOverWebsocket(this.currentPlayingStatus())
                        break;
                    case 'toggleRecording':
                        this.toggleRecording()
                        this.broadcastOverWebsocket(this.currentRecordingStatus())
                        this.broadcastOverWebsocket(this.fetchRecordingsData())
                        break;
                    case 'setIoConfig':
                        this.setIoConfig(parsedMessage.oscRelayEnabled, parsedMessage.oscDestinationAddress, parsedMessage.oscDestinationPort, parsedMessage.broadcastInterval)
                        this.broadcastOverWebsocket(this.currentIoConfig())
                        break;
                    case 'deleteRecording':
                        this.deleteRecording(parsedMessage.recording)
                        this.broadcastOverWebsocket(this.fetchRecordingsData())
                        break;
                    default:
                        console.log('received unknown msg: %s', msg)
                }
            })
        })
        this.websocketReady = true
    }

    setIoConfig(enabled, address, port, broadcastInterval) {
        if (typeof enabled === 'boolean') this.oscRelayEnabled = enabled
        if (address) this.oscDestinationAddress = address
        if (port) this.oscDestinationPort = port
        if (broadcastInterval) {
            this.broadcastIntervalInMs = parseInt(broadcastInterval) > 0 ? broadcastInterval : 1
            this.stopBroadcast()
            this.setUpBroadcastAtInterval()
        }
    }

    currentIoConfig() {
        return {
            type: 'ioConfig',
            websocketBroadcastPort: this.websocketBroadcastPort,
            oscReceiverPort: this.oscReceiverPort,
            oscRelayEnabled: this.oscRelayEnabled,
            oscDestinationAddress: this.oscDestinationAddress,
            oscDestinationPort: this.oscDestinationPort,
            broadcastInterval: this.broadcastIntervalInMs,
        }
    }

    broadcastSavedMessages() {
        if (!this.udpReady) throw new Error('UDP not ready')
        if (!this.websocketReady) throw new Error('Websocket not ready')
        
        const msgs = this.savedMessages
        if (Object.keys(msgs).length) {
            this.broadcastOverWebsocket(msgs)
            if (this.oscRelayEnabled) this.broadcastOverUDP(msgs)
        }
        if (this.recordingInProgress) this.currentRecordingData.push({...msgs})
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

    fetchRecordingsData() {
        return {
            type: 'recordingsData',
            recordings: fs.readdirSync('./recordings') || []
        }
    }

    currentRecordingStatus() {
        return {
            type: 'recordingStatus',
            isRecording: this.recordingInProgress
        }
    }
    
    currentPlayingStatus() {
        return {
            type: 'playingStatus',
            nowPlaying: Object.entries(this.nowPlaying).reduce((acc, [recording, playing]) => {
                const item = playing ? [recording] : []
                return [...acc, ...item]
            }, [])
        }
    }

    playRecording(recording) {
        this.playbackInProgress = true
        this.nowPlaying[recording] = true

        try {
            const rawRecording = fs.readFileSync(`./recordings/${recording}`)
            const recordingData = JSON.parse(rawRecording)
            recordingData.forEach((messageSet, i) => {
                setTimeout(() => {
                    Object.entries(messageSet).forEach(([address, args]) => { 
                        this.saveMessage({ address, args }, true)
                    })
                    const isLastMessage = recordingData.length === i + 1
                    if (isLastMessage) setTimeout(() => { 
                        this.nowPlaying[recording] = false
                        const isAnythingPlaying = Object.values(this.nowPlaying).some(recording => !!recording)
                        if (!isAnythingPlaying) this.playbackInProgress = false
                    }, this.broadcastIntervalInMs)
                }, this.broadcastIntervalInMs * i);
            })

        } catch(err) {
            console.log('recording playback error:', err)
            this.nowPlaying[recording] = false
            const isAnythingPlaying = Object.values(this.nowPlaying).some(recording => !!recording)
            if (!isAnythingPlaying) this.playbackInProgress = false
            return
        }
    }

    deleteRecording(recording) {
        try {
            fs.unlinkSync(`./recordings/${recording}`)
        } catch(err) {
            console.log('recording deletion error:', err)
            return
        }
    }

    toggleRecording() {
        if (this.recordingInProgress) { // recording is in progress, we need to save the file and stop the recording    
            fs.writeFileSync(`./recordings/${this.currentRecordingFilename}`, JSON.stringify(this.currentRecordingData), 'utf8')
            this.currentRecordingFilename = 'default.json'
            this.currentRecordingData = []
        } else { // start recording
            const now = new Date()
            this.currentRecordingFilename = `${now.getUTCFullYear()}-${now.getUTCMonth()+1}-${now.getUTCDate()}_${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()}.json`
            this.currentRecordingData = []
        }

        this.recordingInProgress = !this.recordingInProgress
    }

} 
