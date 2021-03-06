const rawMessageContainer = document.getElementById('rawMessageContainer')
const pre = document.getElementById('rawMessage')
const host = window.location.host
const parsedHost = host.split(':')[0]

const str = (x) => JSON.stringify(x)

// function to inject buttons to trigger pre-made "recordings" that live server-side
const recordingsContainer = document.getElementById('recordingsContainer')
const populateRecordings = (recordings) => {
    recordingsContainer.innerHTML = ''
    for (let recording of recordings) {
        const recordingNameNeat = recording.replace('.json','')
        const playRecordingButton = document.createElement('div')
        playRecordingButton.id = `recording-${recordingNameNeat}`
        playRecordingButton.classList.add('playbackButton')
        playRecordingButton.classList.add('button')
        playRecordingButton.addEventListener('click', (e) => { 
            if (!e) var e = window.event
            e.cancelBubble = true
            if (e.stopPropagation) e.stopPropagation()
            
            ws.send(str({ type: 'playRecording', recording })) 
            setTimeout(() => { ws.send(str({type: 'playingStatus'})) }, 100)
        })
        
        const playRecordingButtonImg = document.createElement('img')
        playRecordingButtonImg.classList.add('svgIcon')
        playRecordingButtonImg.setAttribute('src', './icons/play.svg')
        const playRecordingButtonText = document.createElement('span')
        playRecordingButtonText.innerText = recordingNameNeat
        playRecordingButton.appendChild(playRecordingButtonImg)
        playRecordingButton.appendChild(playRecordingButtonText)

        const deleteRecordingButton = document.createElement('img')
        deleteRecordingButton.classList.add('svgIcon')
        deleteRecordingButton.setAttribute('src', './icons/delete.svg')
        deleteRecordingButton.addEventListener('click', (e) => {
            if (!e) var e = window.event
            e.cancelBubble = true
            if (e.stopPropagation) e.stopPropagation()

            const confirmation = confirm(`Are you sure you want to delete recording ${recordingNameNeat}?`)
            if (confirmation) {
                ws.send(str({ type: 'deleteRecording', recording })) 
                setTimeout(() => { ws.send(str({type: 'loadRecordings'})) }, 100)
            }
        })
        playRecordingButton.appendChild(deleteRecordingButton)
        
        recordingsContainer.appendChild(playRecordingButton)
    }
}

// ask server to start or stop recording data
const toggleRecordingButton = document.getElementById('toggleRecordingButton')
toggleRecordingButton.addEventListener('click', (e) => {
    if (!e) var e = window.event
    e.cancelBubble = true
    if (e.stopPropagation) e.stopPropagation()

    ws.send(str({type: 'toggleRecording'}))
    setTimeout(() => { ws.send(str({type: 'loadRecordings'})) }, 100)
})
// function that sets the color of the recording button
const colorRecordingButton = (isRecording) => {
    const recordButtonImage = document.createElement('img')
    recordButtonImage.classList.add('svgIcon')
    recordButtonImage.classList.add('recordingIcon')
    recordButtonImage.setAttribute('src', `./icons/${isRecording ? 'stop': 'record'}.svg`)
    const recordingButtonText = document.createElement('span')
    recordingButtonText.innerText = `${isRecording ? 'Stop' : 'Start'} Recording`

    // replace all HTML in record button
    toggleRecordingButton.innerHTML = ''
    toggleRecordingButton.appendChild(recordButtonImage)
    toggleRecordingButton.appendChild(recordingButtonText)
    toggleRecordingButton.classList[isRecording ? 'add' : 'remove']('recording')
    
}
// function that sets the color of any play button
const colorPlaybackButton = (nowPlaying) => {
    const allPlaybackButtons = document.getElementsByClassName('playbackButton')
    for (let btn of allPlaybackButtons) {
        btn.classList.remove('playing')
    }
    for (let recording of nowPlaying) {
        const recordingNameNeat = recording.replace(".json","")
        const playRecordingButton = document.getElementById(`recording-${recordingNameNeat}`)
        playRecordingButton.classList.add('playing')
    }
}

// showing and updating server config data to the page
const wsAddress = document.getElementById('wsAddress')
const wsPort = document.getElementById('wsPort')

let broadcastIntervalInMs = 100
const broadcastInterval = document.getElementById('broadcastInterval')
broadcastInterval.addEventListener('change', () => {
    ws.send(str({
        type: 'setIoConfig',
        broadcastInterval: broadcastInterval.value
    }))
})
broadcastInterval.addEventListener('keypress', (e) => {
    if (e.key == 'Enter') e.preventDefault(); return false
})

const oscRelayToggle = document.getElementById('oscRelayToggle')
oscRelayToggle.addEventListener('click', () => {
    ws.send(str({
        type: 'setIoConfig',
        oscRelayEnabled: oscRelayToggle.checked
    }))
})

const oscDestinationAddress = document.getElementById('oscDestinationAddress')
oscDestinationAddress.addEventListener('change', () => {
    ws.send(str({
        type: 'setIoConfig',
        oscDestinationAddress: oscDestinationAddress.value
    }))
})

const oscDestinationPort = document.getElementById('oscDestinationPort')
oscDestinationPort.addEventListener('change', () => {
    ws.send(str({
        type: 'setIoConfig',
        oscDestinationPort: oscDestinationPort.value
    }))
})

const populateIoConfig = (oscDestAddr, oscDestPort, websocketBroadcastPort, oscRelayEnabled, broadcastIntervalInMs) => {
    wsAddress.value = parsedHost
    if (oscDestinationAddress !== document.activeElement) oscDestinationAddress.value = oscDestAddr
    if (oscDestinationPort !== document.activeElement) oscDestinationPort.value = oscDestPort
    wsPort.value = websocketBroadcastPort
    oscRelayToggle.checked = oscRelayEnabled
    if (broadcastInterval !== document.activeElement) broadcastInterval.value = broadcastIntervalInMs
}

let staleTimer = null
const freshenUpForMs = (ms) => {
    rawMessageContainer.classList.remove('stale')
    if (staleTimer) clearTimeout(staleTimer)
    staleTimer = setTimeout(() => { rawMessageContainer.classList.add('stale') }, ms)
}

// set up websocket connection to server and handle messages
const ws = new WebSocket(`ws://${parsedHost}:8080/ws`) 

ws.onopen = () => {
    ws.send(str({ type: 'loadRecordings' }))
    ws.send(str({ type: 'recordingStatus' }))
    ws.send(str({ type: 'playingStatus' }))
    ws.send(str({ type: 'ioConfig' }))
}
ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data)
    switch (data.type) {
        case 'recordingsData':
            populateRecordings(data.recordings)
            break;
        case 'recordingStatus':
            colorRecordingButton(data.isRecording)
            break;
        case 'playingStatus':
            colorPlaybackButton(data.nowPlaying)
            break;
        case 'ioConfig':
            populateIoConfig(
                data.oscDestinationAddress,
                data.oscDestinationPort,
                data.websocketBroadcastPort,
                data.oscRelayEnabled,
                data.broadcastInterval
            )
            broadcastIntervalInMs = data.broadcastInterval
            if (pre.className === 'initialMessage') {
                pre.innerHTML = `Waiting for OSC messages on ${parsedHost}:${data.oscReceiverPort || '????'}`
                pre.classList.remove('initialMessage')
            }
            break;
        default:
            pre.innerHTML = msg.data
            freshenUpForMs(broadcastIntervalInMs * 2) // if this doesn't get re-hit within the time limit, go "stale"
    }
}