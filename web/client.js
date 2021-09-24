const rawMessageContainer = document.getElementById('rawMessageContainer')
const pre = document.getElementById('rawMessage')
const host = window.location.host
const parsedHost = host.split(':')[0]

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
            
            ws.send(JSON.stringify({ type: 'playRecording', recording })) 
            setTimeout(() => { ws.send(JSON.stringify({type: 'playingStatus'})) }, 100)
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
                ws.send(JSON.stringify({ type: 'deleteRecording', recording })) 
                setTimeout(() => { ws.send(JSON.stringify({type: 'loadRecordings'})) }, 100)
            }
        })
        playRecordingButton.appendChild(deleteRecordingButton)
        
        recordingsContainer.appendChild(playRecordingButton)
    }
}

// ask server to start or stop recording data
const toggleRecordingButton = document.getElementById('toggleRecordingButton')
toggleRecordingButton.addEventListener('click', () => {
    ws.send(JSON.stringify({type: 'toggleRecording'}))
    setTimeout(() => { ws.send(JSON.stringify({type: 'loadRecordings'})) }, 100)
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

const oscRelayToggle = document.getElementById('oscRelayToggle')
oscRelayToggle.addEventListener('click', () => {
    ws.send(JSON.stringify({
        type: 'setIoConfig',
        oscRelayEnabled: oscRelayToggle.checked
    }))
})

const oscDestinationAddress = document.getElementById('oscDestinationAddress')
oscDestinationAddress.addEventListener('change', () => {
    ws.send(JSON.stringify({
        type: 'setIoConfig',
        oscDestinationAddress: oscDestinationAddress.value
    }))
})

const oscDestinationPort = document.getElementById('oscDestinationPort')
oscDestinationPort.addEventListener('change', () => {
    ws.send(JSON.stringify({
        type: 'setIoConfig',
        oscDestinationPort: oscDestinationPort.value
    }))
})

const populateIoConfig = (oscDestAddr, oscDestPort, oscReceiverPort, websocketBroadcastPort, oscRelayEnabled) => {
    wsAddress.value = parsedHost
    wsPort.value = websocketBroadcastPort
    if (oscDestinationAddress !== document.activeElement) oscDestinationAddress.value = oscDestAddr
    if (oscDestinationPort !== document.activeElement) oscDestinationPort.value = oscDestPort
    oscRelayToggle.checked = oscRelayEnabled
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
    ws.send(JSON.stringify({ type: 'loadRecordings' }))
    setInterval(() => {
        ws.send(JSON.stringify({ type: 'recordingStatus' }))
        ws.send(JSON.stringify({ type: 'playingStatus' }))
        ws.send(JSON.stringify({ type: 'ioConfig' }))
    }, 2000)
}
ws.onmessage = (msg) => {
    const parsedData = JSON.parse(msg.data)
    switch (parsedData.type) {
        case 'recordingsData':
            populateRecordings(parsedData.recordings)
            break;
        case 'recordingStatus':
            colorRecordingButton(parsedData.isRecording)
            break;
        case 'playingStatus':
            colorPlaybackButton(parsedData.nowPlaying)
            break;
        case 'ioConfig':
            populateIoConfig(
                parsedData.oscDestinationAddress,
                parsedData.oscDestinationPort,
                parsedData.oscReceiverPort,
                parsedData.websocketBroadcastPort,
                parsedData.oscRelayEnabled
            )
            if (pre.className === 'initialMessage') {
                pre.innerHTML = `Waiting for OSC messages on ${parsedHost}:${parsedData.oscReceiverPort || '????'}`
                pre.classList.remove('initialMessage')
            }
            break;
        default:
            pre.innerHTML = msg.data
            freshenUpForMs(200) // if this doesn't get re-hit within the time limit, go "stale"
    }
}